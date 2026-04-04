/**
 * build834EnrollmentGroups.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Transforms the flat parsed 834 loop tree (from EDIParser.parse()) into a
 * deeply nested, relational object implementing three views:
 *
 *   1. Dependent Roll-Up       — Subscriber → [Dependents]
 *   2. Family Enrollment Group — Coverage tier + total member count
 *   3. COB View                — Secondary coverage detection per member
 *
 * Input:  parseResult from useAppStore — specifically parseResult.loops
 * Output: EnrollmentGroup[]
 */

// ── Reference maps ────────────────────────────────────────────────────────────

const RELATIONSHIP_LABELS: Record<string, string> = {
  '18': 'Self',
  '01': 'Spouse',
  '19': 'Child',
  '34': 'Other Adult',
  '15': 'Ward',
  '53': 'Life Partner',
  '29': 'Significant Other',
  '32': 'Mother',
  '33': 'Father',
  'G8': 'Other Relationship',
}

const MAINTENANCE_LABELS: Record<string, string> = {
  '001': 'Change',
  '021': 'Addition',
  '024': 'Termination',
  '025': 'Cancellation / Disenrollment',
  '030': 'Audit / Active',
  '032': 'Employee Status Change',
}

const BENEFIT_STATUS_LABELS: Record<string, string> = {
  'A': 'Active',
  'C': 'COBRA',
  'S': 'Surviving Insured',
  'T': 'Tax Levy',
}

const COVERAGE_LEVEL_LABELS: Record<string, string> = {
  'EMP': 'Employee Only',
  'IND': 'Individual',
  'FAM': 'Family',
  'ECH': 'Employee + Children',
  'ESP': 'Employee + Spouse',
  'TWO': 'Two-Party',
  'DEP': 'Dependent Only',
  'CHD': 'Children Only',
  'SPC': 'Spouse & Children',
  'FAM+': 'Family (Extended)',
}

const INSURANCE_LINE_LABELS: Record<string, string> = {
  'HLT': 'Health',
  'DEN': 'Dental',
  'VIS': 'Vision',
  'MED': 'Medical',
  'LIF': 'Life',
  'STD': 'Short-Term Disability',
  'LTD': 'Long-Term Disability',
  'RX':  'Prescription Drug',
}

const PAYER_RESPONSIBILITY_LABELS: Record<string, string> = {
  'P': 'Primary',
  'S': 'Secondary',
  'T': 'Tertiary',
  'U': 'Unknown',
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CobDetail {
  payerResponsibility: string        // COB*1 raw code
  payerResponsibilityLabel: string   // e.g. "Primary"
  cobCode: string                    // COB*3
  otherCoverageId: string            // COB*2
  otherPayerName: string             // NM1*3 from 834_2320
}

export interface CoverageDetail {
  insuranceLine: string              // HD*3 raw
  insuranceLineLabel: string         // e.g. "Health"
  planDescription: string            // HD*4
  coverageLevel: string              // HD*5 raw
  coverageLevelLabel: string         // e.g. "Family"
  effectiveDate: string              // DTP 348
  expirationDate: string             // DTP 349 (if present)
}

export interface EnrollmentMember {
  memberId: string                   // REF*0F value
  name: string                       // NM1 first + last
  firstName: string
  lastName: string
  dob: string                        // DMG*2
  gender: string                     // DMG*3 decoded
  address: string                    // N3 + N4
  isSubscriber: boolean              // INS*1 == 'Y'
  relationshipCode: string           // INS*2 raw
  relationshipLabel: string          // e.g. "Spouse"
  maintenanceTypeCode: string        // INS*3
  maintenanceTypeLabel: string       // e.g. "Addition"
  maintenanceReasonCode: string      // INS*4
  benefitStatusCode: string          // INS*5
  benefitStatusLabel: string         // e.g. "Active"
  effectiveDate: string              // DTP*356
  hasSecondaryCoverage: boolean
  cobDetails: CobDetail[]
  coverage: CoverageDetail[]
}

export interface EnrollmentGroup {
  groupId: string                    // subscriber memberId
  subscriberName: string
  coverageLevel: string              // HD*5 raw from first HD in group
  coverageLevelLabel: string
  totalMembers: number
  subscriber: EnrollmentMember
  dependents: EnrollmentMember[]
}

// ── Raw helpers ───────────────────────────────────────────────────────────────

function rd(seg: any, idx: number, fallback = ''): string {
  const raw: unknown[] = seg?.raw_data ?? []
  return String(raw[idx] ?? '').trim() || fallback
}

function getInstances(loops: Record<string, any>, key: string): any[] {
  const raw = loops[key]
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

// ── Main transform ────────────────────────────────────────────────────────────

export function build834EnrollmentGroups(parseResult: Record<string, any>): EnrollmentGroup[] {
  // Unwrap API envelope if present
  const tree = parseResult?.data ?? parseResult
  const loops: Record<string, any> = tree?.loops ?? {}

  const insInstances  = getInstances(loops, '834_2000')
  const nm1Instances  = getInstances(loops, '834_2100A')
  const hdInstances   = getInstances(loops, '834_2300')
  const cobInstances  = getInstances(loops, '834_2320')

  // ── 1. Build flat member list with COB and coverage attached ───────────────
  let hdIdx  = 0
  let cobIdx = 0

  const members: EnrollmentMember[] = insInstances.map((insLoop, i) => {
    const ins = insLoop?.INS ?? {}
    const ref = insLoop?.REF ?? {}
    const dtp = insLoop?.DTP ?? {}

    const nm1Loop = nm1Instances[i] ?? {}
    const nm1 = nm1Loop?.NM1 ?? {}
    const dmg = nm1Loop?.DMG ?? {}
    const n3  = nm1Loop?.N3  ?? {}
    const n4  = nm1Loop?.N4  ?? {}

    // Identity
    const isSubscriber = rd(ins, 1).toUpperCase() === 'Y'
    const firstName    = rd(nm1, 4)
    const lastName     = rd(nm1, 3)
    const name         = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown'
    const memberId     = rd(ref, 2) || `UNK-${i + 1}`

    // Demographics
    const dobRaw    = rd(dmg, 2)
    const genderRaw = rd(dmg, 3)
    const gender    = genderRaw === 'M' ? 'Male' : genderRaw === 'F' ? 'Female' : genderRaw || '—'

    const street  = rd(n3, 1)
    const city    = rd(n4, 1)
    const state   = rd(n4, 2)
    const zip     = rd(n4, 3)
    const address = [street, city && `${city}, ${state} ${zip}`].filter(Boolean).join(' · ') || '—'

    // INS fields
    const relCode     = rd(ins, 2)
    const maintCode   = rd(ins, 3)
    const maintReason = rd(ins, 4)
    const benefitCode = rd(ins, 5)
    const effDate     = rd(dtp, 3)

    // ── Coverage (HD loops) — collect until the next subscriber boundary ────
    const coverage: CoverageDetail[] = []
    const maxHd = isSubscriber ? 3 : 1  // heuristic: subscribers can have multiple plans

    while (hdIdx < hdInstances.length && coverage.length < maxHd) {
      const hdLoop = hdInstances[hdIdx]
      const hd     = hdLoop?.HD  ?? {}
      const hdDtp  = hdLoop?.DTP ?? {}
      const insLine    = rd(hd, 3)
      const planDesc   = rd(hd, 4)
      const covLevel   = rd(hd, 5)
      const covDate    = rd(hdDtp, 3)

      // DTP 349 = expiration — look for it in the same loop instance
      const hdDtpArr: any[] = Array.isArray(hdLoop?.DTP)
        ? hdLoop.DTP
        : hdLoop?.DTP ? [hdLoop.DTP] : []
      const expDtp = hdDtpArr.find((d: any) => rd(d, 1) === '349')
      const expDate = expDtp ? rd(expDtp, 3) : ''

      coverage.push({
        insuranceLine:       insLine,
        insuranceLineLabel:  INSURANCE_LINE_LABELS[insLine] ?? insLine,
        planDescription:     planDesc,
        coverageLevel:       covLevel,
        coverageLevelLabel:  COVERAGE_LEVEL_LABELS[covLevel] ?? covLevel,
        effectiveDate:       covDate,
        expirationDate:      expDate,
      })
      hdIdx++
    }

    // ── COB (834_2320) — one block per member ────────────────────────────────
    const cobDetails: CobDetail[] = []
    // COB loops appear directly after the member's NM1/HD in sequence
    // We assign one COB block per member (most files) and advance the pointer
    if (cobIdx < cobInstances.length) {
      const cobLoop = cobInstances[cobIdx]
      const cob    = cobLoop?.COB ?? {}
      const cobNm1 = cobLoop?.NM1 ?? {}
      const payerResp = rd(cob, 1)
      const otherId   = rd(cob, 2)
      const cobCode   = rd(cob, 3)
      const payerName = rd(cobNm1, 3)

      if (payerResp || otherId) {
        cobDetails.push({
          payerResponsibility:      payerResp,
          payerResponsibilityLabel: PAYER_RESPONSIBILITY_LABELS[payerResp] ?? payerResp,
          cobCode,
          otherCoverageId:  otherId,
          otherPayerName:   payerName || '—',
        })
        cobIdx++
      }
    }

    return {
      memberId,
      name,
      firstName,
      lastName,
      dob:                  dobRaw,
      gender,
      address,
      isSubscriber,
      relationshipCode:     relCode,
      relationshipLabel:    RELATIONSHIP_LABELS[relCode] ?? relCode || '—',
      maintenanceTypeCode:  maintCode,
      maintenanceTypeLabel: MAINTENANCE_LABELS[maintCode] ?? maintCode || '—',
      maintenanceReasonCode: maintReason,
      benefitStatusCode:    benefitCode,
      benefitStatusLabel:   BENEFIT_STATUS_LABELS[benefitCode] ?? benefitCode || '—',
      effectiveDate:        effDate,
      hasSecondaryCoverage: cobDetails.length > 0,
      cobDetails,
      coverage,
    }
  })

  // ── 2. Group members: Subscriber roots + dependent roll-up ────────────────
  const groups: EnrollmentGroup[] = []
  let currentGroup: EnrollmentGroup | null = null

  for (const member of members) {
    if (member.isSubscriber) {
      const primaryCoverage = member.coverage[0]
      currentGroup = {
        groupId:            member.memberId,
        subscriberName:     member.name,
        coverageLevel:      primaryCoverage?.coverageLevel ?? '—',
        coverageLevelLabel: primaryCoverage?.coverageLevelLabel ?? '—',
        totalMembers:       1,
        subscriber:         member,
        dependents:         [],
      }
      groups.push(currentGroup)
    } else {
      if (currentGroup) {
        currentGroup.dependents.push(member)
        currentGroup.totalMembers++
        // Upgrade coverage level label if a FAM/ECH level plan is found on a dependent
        const famCov = member.coverage[0]
        if (famCov && ['FAM', 'ECH', 'ESP', 'SPC'].includes(famCov.coverageLevel)) {
          currentGroup.coverageLevel      = famCov.coverageLevel
          currentGroup.coverageLevelLabel = famCov.coverageLevelLabel
        }
      } else {
        // Orphaned dependent — wrap in its own group
        currentGroup = {
          groupId:            member.memberId,
          subscriberName:     '— Unknown Subscriber —',
          coverageLevel:      member.coverage[0]?.coverageLevel ?? '—',
          coverageLevelLabel: member.coverage[0]?.coverageLevelLabel ?? '—',
          totalMembers:       1,
          subscriber:         { ...member, isSubscriber: true },
          dependents:         [],
        }
        groups.push(currentGroup)
      }
    }
  }

  return groups
}