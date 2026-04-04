"""
EDI Generator — Production-Grade X12 EDI File Serializer
=========================================================
Takes a JSON AST (produced by EDIParser, potentially edited by users)
and serializes it back into a properly formatted X12 EDI text string.

This generator:
  1. Reverse-maps friendly JSON keys (e.g., "TotalClaimChargeAmount_02") 
     back to element indices
  2. Flattens the hierarchical loop structure into a linear segment list
  3. Dynamically recalculates control counts (SE01, GE01, IEA01)
  4. Supports configurable delimiters (pulled from metadata or defaulted)
"""

import re
from typing import Any, Optional


class EDIGenerator:
    """
    Converts a parsed EDI JSON tree back into a formatted X12 EDI string.
    """

    LOOP_ORDER_837 = [
        "HEADER",
        "1000A", "1000B",
        "2000A", "2010AA", "2010AB",
        "2000B", "2010BA", "2010BB",
        "2000C", "2010CA",
        "2000D", "2010DA",
        "2300", "2310A", "2310B", "2310C", "2310D", "2310E", "2310F",
        "2320", "2330A", "2330B", "2330C", "2330D", "2330E", "2330F", "2330G",
        "2400", "2410", "2420A", "2420B", "2420C", "2420D", "2420E", "2420F", "2420G",
        "2430", "2440",
    ]

    LOOP_ORDER_835 = [
        "HEADER", "835_HEADER",
        "835_1000A", "835_1000B",
        "835_2000", "835_2100", "835_2110",
    ]

    LOOP_ORDER_834 = [
        "HEADER", "834_HEADER",
        "834_1000A", "834_1000B", "834_1000C",
        "834_2000", "834_2100A", "834_2100B", "834_2100C", "834_2100D",
        "834_2100E", "834_2100F", "834_2100G", "834_2100H",
        "834_2200", "834_2300", "834_2310", "834_2320", "834_2400", "834_2700",
    ]

    ENVELOPE_SEGMENTS = {"ISA", "GS", "ST", "SE", "GE", "IEA"}

    def __init__(self, tree: dict):
        self.tree = tree
        self.metadata = tree.get("metadata", {})
        self.envelope = tree.get("envelope", {})
        self.loops = tree.get("loops", {})

        # Pull delimiters from metadata (set by parser), fall back to defaults
        self.element_sep = self.metadata.get("element_sep", "*")
        self.subelement_sep = self.metadata.get("subelement_sep", ":")
        self.segment_sep = self.metadata.get("segment_sep", "~")

        self._segment_count = 0
        self._transaction_count = 0
        self._group_count = 0

    # =========================================================================
    # CORE GENERATION
    # =========================================================================

    def generate(self) -> str:
        output_segments: list[str] = []

        # 1. ISA
        isa_seg = self._encode_envelope_segment("ISA")
        if isa_seg:
            output_segments.append(isa_seg)

        # 2. GS
        gs_seg = self._encode_envelope_segment("GS")
        if gs_seg:
            output_segments.append(gs_seg)

        # 3. ST — starts segment counting
        st_seg = self._encode_envelope_segment("ST")
        if st_seg:
            output_segments.append(st_seg)
            self._segment_count = 1

        # 4. All loop segments
        for seg in self._flatten_loops():
            output_segments.append(seg)
            self._segment_count += 1

        # 5. SE with dynamic count
        self._segment_count += 1
        output_segments.append(self._encode_se_segment())
        self._transaction_count = 1

        # 6. GE
        output_segments.append(self._encode_ge_segment())
        self._group_count = 1

        # 7. IEA
        output_segments.append(self._encode_iea_segment())

        return self.segment_sep.join(output_segments) + self.segment_sep

    def _encode_envelope_segment(self, seg_id: str) -> Optional[str]:
        """
        Encode an envelope segment (ISA, GS, ST) from self.envelope.

        The parser stores envelope segments in two possible shapes:
          Shape A — has raw_data:  {"raw_data": ["ISA","00",...], ...}
          Shape B — keyed fields:  {"ISA01": "00", "ISA02": "  ", ...}
                                   (NO "Segment_ID" key, NO "raw_data")

        This method handles both shapes, with seg_id injected explicitly.
        """
        seg = self.envelope.get(seg_id, {})
        if not seg or not isinstance(seg, dict):
            return None

        # Shape A: raw_data is present — use it directly
        raw_data = seg.get("raw_data")
        if raw_data and isinstance(raw_data, list) and len(raw_data) > 0:
            elements = [str(el) for el in raw_data]
            while len(elements) > 1 and elements[-1] == "":
                elements.pop()
            return self.element_sep.join(elements)

        # Shape B: keyed as ISA01..ISA16 / GS01..GS08 / ST01..ST03
        # Find the highest numeric suffix to determine element count
        prefix = seg_id  # e.g. "ISA", "GS", "ST"
        elements_map: dict[int, str] = {}
        max_index = 0
        for key, value in seg.items():
            if key == "raw_data":
                continue
            # Match keys like "ISA01", "GS08", "ST02"
            m = re.fullmatch(rf"{re.escape(prefix)}(\d+)", key)
            if m:
                idx = int(m.group(1))
                elements_map[idx] = str(value) if value is not None else ""
                max_index = max(max_index, idx)

        if max_index == 0:
            return None

        elements = [seg_id]
        for i in range(1, max_index + 1):
            elements.append(elements_map.get(i, ""))

        # Do NOT strip trailing empties from ISA — it must be exactly 16 elements
        # for other segments (GS, ST) stripping is fine
        if seg_id != "ISA":
            while len(elements) > 1 and elements[-1] == "":
                elements.pop()

        return self.element_sep.join(elements)

    def _flatten_loops(self) -> list[str]:
        segments: list[str] = []

        txn_type = self.metadata.get("transaction_type", "837")
        if txn_type == "835":
            loop_order = self.LOOP_ORDER_835
        elif txn_type == "834":
            loop_order = self.LOOP_ORDER_834
        else:
            loop_order = self.LOOP_ORDER_837

        all_loop_ids = set(self.loops.keys())
        ordered_loops = [lid for lid in loop_order if lid in all_loop_ids]
        unordered_loops = sorted(all_loop_ids - set(loop_order))

        for loop_id in ordered_loops + unordered_loops:
            loop_instances = self.loops.get(loop_id, [])
            if not isinstance(loop_instances, list):
                loop_instances = [loop_instances]

            for instance in loop_instances:
                if not isinstance(instance, dict):
                    continue
                for seg_id, seg_data in instance.items():
                    if seg_id in ("Segment_ID", "raw_data") or seg_id in self.ENVELOPE_SEGMENTS:
                        continue
                    if isinstance(seg_data, list):
                        for seg in seg_data:
                            encoded = self._encode_segment(seg)
                            if encoded:
                                segments.append(encoded)
                    else:
                        encoded = self._encode_segment(seg_data)
                        if encoded:
                            segments.append(encoded)

        return segments

    # =========================================================================
    # SEGMENT ENCODING — raw_data first, then reverse-map
    # =========================================================================

    def _encode_segment(self, segment: dict) -> Optional[str]:
        if not segment or not isinstance(segment, dict):
            return None

        seg_id = segment.get("Segment_ID", "")
        if not seg_id:
            # Fallback: infer seg_id from raw_data[0] if available
            raw_data = segment.get("raw_data")
            if raw_data and isinstance(raw_data, list) and raw_data:
                seg_id = str(raw_data[0]).strip().upper()
            if not seg_id:
                return None

        # STRATEGY 1: Use raw_data (always present from fixed parser)
        raw_data = segment.get("raw_data")
        if raw_data and isinstance(raw_data, list) and len(raw_data) > 0:
            elements = [str(el) for el in raw_data]
            while len(elements) > 1 and elements[-1] == "":
                elements.pop()
            return self.element_sep.join(elements)

        # STRATEGY 2: Reverse-map from _NN property names
        max_index = 0
        elements_map: dict[int, str] = {}

        for key, value in segment.items():
            if key in ("Segment_ID", "raw_data"):
                continue
            index = self._extract_element_index(key)
            if index is not None:
                elements_map[index] = self._encode_element_value(value)
                max_index = max(max_index, index)

        if max_index == 0:
            return seg_id

        elements = [seg_id]
        for i in range(1, max_index + 1):
            elements.append(elements_map.get(i, ""))

        while len(elements) > 1 and elements[-1] == "":
            elements.pop()

        return self.element_sep.join(elements)

    def _extract_element_index(self, property_name: str) -> Optional[int]:
        match = re.search(r"_(\d+)$", property_name)
        if match:
            return int(match.group(1))
        return None

    def _encode_element_value(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, list):
            return self.subelement_sep.join(str(v) for v in value)
        return str(value)

    # =========================================================================
    # DYNAMIC CONTROL SEGMENTS
    # =========================================================================

    def _get_raw_element(self, envelope_key: str, index: int, fallback: str) -> str:
        """Safely extract an element from envelope raw_data by index."""
        seg = self.envelope.get(envelope_key, {})
        raw = seg.get("raw_data", [])
        if raw and len(raw) > index:
            val = str(raw[index]).strip()
            if val:
                return val
        # Fallback: read from keyed fields e.g. ISA13, GS06, ST02
        prefix = envelope_key
        keyed_val = seg.get(f"{prefix}{index:02d}", "")
        if keyed_val:
            return str(keyed_val).strip()
        return fallback

    def _encode_se_segment(self) -> str:
        st_control = self._get_raw_element("ST", 2, "0001")
        return f"SE{self.element_sep}{self._segment_count}{self.element_sep}{st_control}"

    def _encode_ge_segment(self) -> str:
        gs_control = self._get_raw_element("GS", 6, "1")
        return f"GE{self.element_sep}{self._transaction_count}{self.element_sep}{gs_control}"

    def _encode_iea_segment(self) -> str:
        isa_control = self._get_raw_element("ISA", 13, "000000001")
        return f"IEA{self.element_sep}{self._group_count}{self.element_sep}{isa_control}"

    # =========================================================================
    # UTILITY
    # =========================================================================

    def get_delimiters(self) -> dict:
        return {
            "element_sep": self.element_sep,
            "subelement_sep": self.subelement_sep,
            "segment_sep": self.segment_sep,
        }

    def set_delimiters(self, element_sep=None, subelement_sep=None, segment_sep=None):
        if element_sep:
            self.element_sep = element_sep
        if subelement_sep:
            self.subelement_sep = subelement_sep
        if segment_sep:
            self.segment_sep = segment_sep


def generate_edi(tree: dict, delimiters: dict = None) -> str:
    generator = EDIGenerator(tree)
    if delimiters:
        generator.set_delimiters(**delimiters)
    return generator.generate()