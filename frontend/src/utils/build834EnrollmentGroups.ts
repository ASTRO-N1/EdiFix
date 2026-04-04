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
  payerResponsibility: string
  payerResponsibilityLabel: string
  cobCode: string
  otherCoverageId: string
  otherPayerName: string
}

export interface CoverageDetail {
  insuranceLine: string
  insuranceLineLabel: string
  planDescription: string
  coverageLevel: string
  coverageLevelLabel: string
  effectiveDate: string
  expirationDate: string
}

export interface EnrollmentMember {
  memberId: string
  name: string
  firstName: string
  lastName: string
  dob: string
  gender: string
  address: string
  isSubscriber: boolean
  relationshipCode: string
  relationshipLabel: string
  maintenanceTypeCode: string
  maintenanceTypeLabel: string
  maintenanceReasonCode: string
  benefitStatusCode: string
  benefitStatusLabel: string
  effectiveDate: string
  hasSecondaryCoverage: boolean
  cobDetails: CobDetail[]
  coverage: CoverageDetail[]
}

export interface EnrollmentGroup {
  groupId: string
  subscriberName: string
  coverageLevel: string
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
  const tree  = parseResult?.data ?? parseResult
  const loops: Record<string, any> = tree?.loops ?? {}

  const insInstances = getInstances(loops, '834_2000')
  const nm1Instances = getInstances(loops, '834_2100A')
  const hdInstances  = getInstances(loops, '834_2300')
  const cobInstances = getInstances(loops, '834_2320')

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

    const isSubscriber = rd(ins, 1).toUpperCase() === 'Y'
    const firstName    = rd(nm1, 4)
    const lastName     = rd(nm1, 3)
    const name         = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown'
    const memberId     = rd(ref, 2) || `UNK-${i + 1}`

    const dobRaw    = rd(dmg, 2)
    const genderRaw = rd(dmg, 3)
    const gender    = genderRaw === 'M' ? 'Male' : genderRaw === 'F' ? 'Female' : (genderRaw || '—')

    const street  = rd(n3, 1)
    const city    = rd(n4, 1)
    const state   = rd(n4, 2)
    const zip     = rd(n4, 3)
    const address = [street, city && `${city}, ${state} ${zip}`].filter(Boolean).join(' · ') || '—'

    const relCode     = rd(ins, 2)
    const maintCode   = rd(ins, 3)
    const maintReason = rd(ins, 4)
    const benefitCode = rd(ins, 5)
    const effDate     = rd(dtp, 3)

    // ── Coverage (HD loops) ──────────────────────────────────────────────────
    const coverage: CoverageDetail[] = []
    const maxHd = isSubscriber ? 3 : 1

    while (hdIdx < hdInstances.length && coverage.length < maxHd) {
      const hdLoop = hdInstances[hdIdx]
      const hd     = hdLoop?.HD  ?? {}
      const hdDtp  = hdLoop?.DTP ?? {}

      const insLine  = rd(hd, 3)
      const planDesc = rd(hd, 4)
      const covLevel = rd(hd, 5)
      const covDate  = rd(hdDtp, 3)

      const hdDtpArr: any[] = Array.isArray(hdLoop?.DTP)
        ? hdLoop.DTP
        : hdLoop?.DTP ? [hdLoop.DTP] : []
      const expDtp  = hdDtpArr.find((d: any) => rd(d, 1) === '349')
      const expDate = expDtp ? rd(expDtp, 3) : ''

      coverage.push({
        insuranceLine:      insLine,
        insuranceLineLabel: INSURANCE_LINE_LABELS[insLine] ?? insLine,
        planDescription:    planDesc,
        coverageLevel:      covLevel,
        coverageLevelLabel: COVERAGE_LEVEL_LABELS[covLevel] ?? covLevel,
        effectiveDate:      covDate,
        expirationDate:     expDate,
      })
      hdIdx++
    }

    // ── COB (834_2320) ───────────────────────────────────────────────────────
    const cobDetails: CobDetail[] = []

    if (cobIdx < cobInstances.length) {
      const cobLoop   = cobInstances[cobIdx]
      const cob       = cobLoop?.COB ?? {}
      const cobNm1    = cobLoop?.NM1 ?? {}
      const payerResp = rd(cob, 1)
      const otherId   = rd(cob, 2)
      const cobCode   = rd(cob, 3)
      const payerName = rd(cobNm1, 3)

      if (payerResp || otherId) {
        cobDetails.push({
          payerResponsibility:      payerResp,
          payerResponsibilityLabel: PAYER_RESPONSIBILITY_LABELS[payerResp] ?? payerResp,
          cobCode,
          otherCoverageId: otherId,
          otherPayerName:  payerName || '—',
        })
        cobIdx++
      }
    }

    return {
      memberId,
      name,
      firstName,
      lastName,
      dob:                   dobRaw,
      gender,
      address,
      isSubscriber,
      relationshipCode:      relCode,
      relationshipLabel:     (RELATIONSHIP_LABELS[relCode] ?? relCode) || '—',
      maintenanceTypeCode:   maintCode,
      maintenanceTypeLabel:  (MAINTENANCE_LABELS[maintCode] ?? maintCode) || '—',
      maintenanceReasonCode: maintReason,
      benefitStatusCode:     benefitCode,
      benefitStatusLabel:    (BENEFIT_STATUS_LABELS[benefitCode] ?? benefitCode) || '—',
      effectiveDate:         effDate,
      hasSecondaryCoverage:  cobDetails.length > 0,
      cobDetails,
      coverage,
    }
  })

  // ── Group members into family units ─────────────────────────────────────────
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
        const famCov = member.coverage[0]
        if (famCov && ['FAM', 'ECH', 'ESP', 'SPC'].includes(famCov.coverageLevel)) {
          currentGroup.coverageLevel      = famCov.coverageLevel
          currentGroup.coverageLevelLabel = famCov.coverageLevelLabel
        }
      } else {
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