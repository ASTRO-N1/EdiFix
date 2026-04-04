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
  4. Supports configurable delimiters (pulled from ISA or defaulted)
"""

import re
from typing import Any, Optional


class EDIGenerator:
    """
    Converts a parsed EDI JSON tree back into a formatted X12 EDI string.
    
    Usage:
        generator = EDIGenerator(json_tree)
        edi_string = generator.generate()
    """

    # ─────────────────────────────────────────────────────────────────────────
    # Standard X12 loop ordering for 837/835/834 transactions
    # ─────────────────────────────────────────────────────────────────────────
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

    # Segments that belong to the envelope (handled separately)
    ENVELOPE_SEGMENTS = {"ISA", "GS", "ST", "SE", "GE", "IEA"}

    def __init__(self, tree: dict):
        """
        Initialize the generator with a parsed JSON tree.
        """
        self.tree = tree
        self.metadata = tree.get("metadata", {})
        self.envelope = tree.get("envelope", {})
        self.loops = tree.get("loops", {})

        # Default X12 delimiters
        self.element_sep = "*"
        self.subelement_sep = ":"
        self.segment_sep = "~"

        # For dynamic control counting
        self._segment_count = 0
        self._transaction_count = 0
        self._group_count = 0

    # =========================================================================
    # CORE GENERATION LOGIC
    # =========================================================================

    def generate(self) -> str:
        """
        Main entry point: generates the complete EDI string from the JSON tree.
        """
        output_segments: list[str] = []

        # 1. Generate ISA
        isa_seg = self._encode_envelope_segment("ISA", self.envelope.get("ISA", {}))
        if isa_seg:
            output_segments.append(isa_seg)

        # 2. Generate GS
        gs_seg = self._encode_envelope_segment("GS", self.envelope.get("GS", {}))
        if gs_seg:
            output_segments.append(gs_seg)

        # 3. Generate ST — starts segment counting
        st_seg = self._encode_envelope_segment("ST", self.envelope.get("ST", {}))
        if st_seg:
            output_segments.append(st_seg)
            self._segment_count = 1

        # 4. Flatten and encode all loops
        loop_segments = self._flatten_loops()
        for seg in loop_segments:
            output_segments.append(seg)
            self._segment_count += 1

        # 5. Generate SE with dynamic count
        self._segment_count += 1
        se_seg = self._encode_se_segment()
        if se_seg:
            output_segments.append(se_seg)
        self._transaction_count = 1

        # 6. Generate GE
        ge_seg = self._encode_ge_segment()
        if ge_seg:
            output_segments.append(ge_seg)
        self._group_count = 1

        # 7. Generate IEA
        iea_seg = self._encode_iea_segment()
        if iea_seg:
            output_segments.append(iea_seg)

        # 8. Join with segment terminator
        return self.segment_sep.join(output_segments) + self.segment_sep

    def _flatten_loops(self) -> list[str]:
        """
        Walks through all loops in the correct hierarchical order.
        """
        segments: list[str] = []

        # Determine loop order based on transaction type
        txn_type = self.metadata.get("transaction_type", "837")
        if txn_type == "835":
            loop_order = self.LOOP_ORDER_835
        elif txn_type == "834":
            loop_order = self.LOOP_ORDER_834
        else:
            loop_order = self.LOOP_ORDER_837

        # Process loops in order, then any remaining
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
                
                # Encode each segment in this loop instance
                instance_segments = self._encode_loop_instance(instance)
                segments.extend(instance_segments)

        return segments

    def _encode_loop_instance(self, instance: dict) -> list[str]:
        """
        Encodes all segments within a single loop instance.
        """
        segments = []
        
        for seg_id, seg_data in instance.items():
            # Skip metadata keys and envelope segments
            if seg_id in ("Segment_ID", "raw_data") or seg_id in self.ENVELOPE_SEGMENTS:
                continue

            # Handle repeated segments (stored as list)
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
    # SEGMENT ENCODING — THE REVERSE MAPPING LOGIC
    # =========================================================================

    def _encode_segment(self, segment: dict) -> Optional[str]:
        """
        Encodes a single segment dictionary back into an EDI string.
        
        Handles multiple data formats:
        1. Decoded with _NN suffixes: {"PatientControlNumber_01": "12345"}
        2. Raw data array: {"raw_data": ["CLM", "12345", "150.00"]}
        """
        if not segment or not isinstance(segment, dict):
            return None

        seg_id = segment.get("Segment_ID", "")
        if not seg_id:
            return None

        # ─────────────────────────────────────────────────────────────────────
        # STRATEGY 1: Use raw_data if available (most reliable)
        # ─────────────────────────────────────────────────────────────────────
        raw_data = segment.get("raw_data")
        if raw_data and isinstance(raw_data, list) and len(raw_data) > 0:
            # raw_data is the original element array
            elements = [str(el) for el in raw_data]
            # Trim trailing empty elements
            while len(elements) > 1 and elements[-1] == "":
                elements.pop()
            return self.element_sep.join(elements)

        # ─────────────────────────────────────────────────────────────────────
        # STRATEGY 2: Reverse-map from _NN suffixed property names
        # ─────────────────────────────────────────────────────────────────────
        max_index = 0
        elements_map: dict[int, str] = {}

        for key, value in segment.items():
            if key in ("Segment_ID", "raw_data"):
                continue

            # Extract index from property name suffix (e.g., "_02" → 2)
            index = self._extract_element_index(key)
            if index is None:
                continue

            # Convert value to string, handling sub-elements
            encoded_value = self._encode_element_value(value)
            elements_map[index] = encoded_value
            max_index = max(max_index, index)

        # If no indexed properties found, segment only has Segment_ID
        if max_index == 0:
            return seg_id

        # Build the ordered elements array
        elements = [seg_id]
        for i in range(1, max_index + 1):
            elements.append(elements_map.get(i, ""))

        # Trim trailing empty elements
        while len(elements) > 1 and elements[-1] == "":
            elements.pop()

        return self.element_sep.join(elements)

    def _encode_envelope_segment(self, seg_id: str, segment: dict) -> Optional[str]:
        """
        Special handling for envelope segments (ISA, GS, ST, SE, GE, IEA).
        These are critical and we try multiple strategies to encode them.
        """
        if not segment:
            return None

        # Strategy 1: Use raw_data
        raw_data = segment.get("raw_data")
        if raw_data and isinstance(raw_data, list) and len(raw_data) > 0:
            elements = [str(el) for el in raw_data]
            while len(elements) > 1 and elements[-1] == "":
                elements.pop()
            return self.element_sep.join(elements)

        # Strategy 2: Reverse-map from _NN properties
        max_index = 0
        elements_map: dict[int, str] = {}

        for key, value in segment.items():
            if key in ("Segment_ID", "raw_data"):
                continue

            index = self._extract_element_index(key)
            if index is not None:
                elements_map[index] = self._encode_element_value(value)
                max_index = max(max_index, index)

        if max_index > 0:
            elements = [seg_id]
            for i in range(1, max_index + 1):
                elements.append(elements_map.get(i, ""))
            while len(elements) > 1 and elements[-1] == "":
                elements.pop()
            return self.element_sep.join(elements)

        # Strategy 3: Build from known field names for envelope segments
        if seg_id == "ISA":
            return self._build_isa_segment(segment)
        elif seg_id == "GS":
            return self._build_gs_segment(segment)
        elif seg_id == "ST":
            return self._build_st_segment(segment)

        return seg_id

    def _build_isa_segment(self, isa: dict) -> str:
        """
        Builds ISA segment from known field mappings.
        ISA is fixed-length with 16 elements.
        """
        # Try to get values from various possible key names
        def get_val(keys: list, default: str = "") -> str:
            for k in keys:
                if k in isa and isa[k]:
                    return str(isa[k])
            return default

        elements = [
            "ISA",
            get_val(["AuthorizationInformationQualifier_01", "ISA01"], "00"),
            get_val(["AuthorizationInformation_02", "ISA02"], "          "),  # 10 spaces
            get_val(["SecurityInformationQualifier_03", "ISA03"], "00"),
            get_val(["SecurityInformation_04", "ISA04"], "          "),  # 10 spaces
            get_val(["InterchangeIDQualifier_05", "ISA05"], "ZZ"),
            get_val(["InterchangeSenderID_06", "ISA06", "sender_id"], "").ljust(15),
            get_val(["InterchangeIDQualifier_07", "ISA07"], "ZZ"),
            get_val(["InterchangeReceiverID_08", "ISA08", "receiver_id"], "").ljust(15),
            get_val(["InterchangeDate_09", "ISA09"], ""),
            get_val(["InterchangeTime_10", "ISA10"], ""),
            get_val(["RepetitionSeparator_11", "ISA11"], "^"),
            get_val(["InterchangeControlVersionNumber_12", "ISA12"], "00501"),
            get_val(["InterchangeControlNumber_13", "ISA13", "control_number"], "000000001"),
            get_val(["AcknowledgmentRequested_14", "ISA14"], "0"),
            get_val(["UsageIndicator_15", "ISA15"], "T"),
            get_val(["ComponentElementSeparator_16", "ISA16"], ":"),
        ]
        return self.element_sep.join(elements)

    def _build_gs_segment(self, gs: dict) -> str:
        """
        Builds GS segment from known field mappings.
        """
        def get_val(keys: list, default: str = "") -> str:
            for k in keys:
                if k in gs and gs[k]:
                    return str(gs[k])
            return default

        elements = [
            "GS",
            get_val(["FunctionalIdentifierCode_01", "GS01"], "HC"),
            get_val(["ApplicationSenderCode_02", "GS02"], ""),
            get_val(["ApplicationReceiverCode_03", "GS03"], ""),
            get_val(["Date_04", "GS04"], ""),
            get_val(["Time_05", "GS05"], ""),
            get_val(["GroupControlNumber_06", "GS06"], "1"),
            get_val(["ResponsibleAgencyCode_07", "GS07"], "X"),
            get_val(["VersionReleaseIndustryIdentifierCode_08", "GS08"], "005010X222A1"),
        ]
        return self.element_sep.join(elements)

    def _build_st_segment(self, st: dict) -> str:
        """
        Builds ST segment from known field mappings.
        """
        def get_val(keys: list, default: str = "") -> str:
            for k in keys:
                if k in st and st[k]:
                    return str(st[k])
            return default

        txn_type = self.metadata.get("transaction_type", "837")
        impl_ref = self.metadata.get("implementation_reference", "")

        elements = [
            "ST",
            get_val(["TransactionSetIdentifierCode_01", "ST01"], txn_type),
            get_val(["TransactionSetControlNumber_02", "ST02"], "0001"),
            get_val(["ImplementationConventionReference_03", "ST03"], impl_ref),
        ]
        
        # Trim empty trailing elements
        while len(elements) > 2 and elements[-1] == "":
            elements.pop()
            
        return self.element_sep.join(elements)

    def _extract_element_index(self, property_name: str) -> Optional[int]:
        """
        Extracts the element index from a property name suffix.
        """
        match = re.search(r"_(\d+)$", property_name)
        if match:
            return int(match.group(1))
        return None

    def _encode_element_value(self, value: Any) -> str:
        """
        Encodes a single element value, handling sub-elements (lists).
        """
        if value is None:
            return ""

        # Sub-elements are stored as lists
        if isinstance(value, list):
            return self.subelement_sep.join(str(v) for v in value)

        return str(value)

    # =========================================================================
    # DYNAMIC CONTROL SEGMENT GENERATION
    # =========================================================================

    def _encode_se_segment(self) -> str:
        """SE segment with dynamic count."""
        st_seg = self.envelope.get("ST", {})
        st_control = (
            st_seg.get("TransactionSetControlNumber_02") or
            st_seg.get("ST02") or
            st_seg.get("ControlNumber_02") or
            "0001"
        )
        return f"SE{self.element_sep}{self._segment_count}{self.element_sep}{st_control}"

    def _encode_ge_segment(self) -> str:
        """GE segment with dynamic count."""
        gs_seg = self.envelope.get("GS", {})
        gs_control = (
            gs_seg.get("GroupControlNumber_06") or
            gs_seg.get("GS06") or
            gs_seg.get("ControlNumber_06") or
            "1"
        )
        return f"GE{self.element_sep}{self._transaction_count}{self.element_sep}{gs_control}"

    def _encode_iea_segment(self) -> str:
        """IEA segment with dynamic count."""
        isa_seg = self.envelope.get("ISA", {})
        isa_control = (
            isa_seg.get("InterchangeControlNumber_13") or
            isa_seg.get("ISA13") or
            isa_seg.get("ControlNumber_13") or
            "000000001"
        )
        return f"IEA{self.element_sep}{self._group_count}{self.element_sep}{isa_control}"

    # =========================================================================
    # UTILITY METHODS
    # =========================================================================

    def get_delimiters(self) -> dict:
        return {
            "element_sep": self.element_sep,
            "subelement_sep": self.subelement_sep,
            "segment_sep": self.segment_sep,
        }

    def set_delimiters(
        self,
        element_sep: str = None,
        subelement_sep: str = None,
        segment_sep: str = None
    ) -> None:
        if element_sep:
            self.element_sep = element_sep
        if subelement_sep:
            self.subelement_sep = subelement_sep
        if segment_sep:
            self.segment_sep = segment_sep


def generate_edi(tree: dict, delimiters: dict = None) -> str:
    """Convenience function to generate EDI from a tree."""
    generator = EDIGenerator(tree)
    if delimiters:
        generator.set_delimiters(**delimiters)
    return generator.generate()