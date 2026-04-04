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
    # The generator will process loops in this sequence to maintain proper
    # hierarchical order in the output EDI file.
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
        
        Args:
            tree: The JSON AST from EDIParser, with structure:
                  {
                      "metadata": {...},
                      "envelope": {"ISA": {...}, "GS": {...}, "ST": {...}, ...},
                      "loops": {"1000A": [...], "2000A": [...], ...},
                      ...
                  }
        """
        self.tree = tree
        self.metadata = tree.get("metadata", {})
        self.envelope = tree.get("envelope", {})
        self.loops = tree.get("loops", {})

        # ─────────────────────────────────────────────────────────────────────
        # Delimiter Configuration
        # Default to standard X12 delimiters; override from ISA if available
        # ─────────────────────────────────────────────────────────────────────
        self.element_sep = "*"
        self.subelement_sep = ":"
        self.segment_sep = "~"

        self._extract_delimiters_from_isa()

        # For dynamic control counting
        self._segment_count = 0  # Counts segments between ST and SE
        self._transaction_count = 0  # Counts ST/SE pairs within GS/GE
        self._group_count = 0  # Counts GS/GE pairs within ISA/IEA

    def _extract_delimiters_from_isa(self) -> None:
        """
        Extract delimiters from the ISA segment if present.
        
        The ISA segment in the tree may contain raw element values or decoded fields.
        We look for specific positions or fall back to detecting from raw_data.
        """
        isa = self.envelope.get("ISA", {})
        if not isa:
            return

        # Check if raw_data is present (original element array)
        raw_data = isa.get("raw_data", [])
        if raw_data and len(raw_data) >= 17:
            # ISA16 contains sub-element separator + segment terminator
            isa16 = raw_data[16] if len(raw_data) > 16 else ":~"
            if len(isa16) >= 1:
                self.subelement_sep = isa16[0]
            if len(isa16) >= 2:
                self.segment_sep = isa16[1]

        # If the tree has decoded ISA fields, we can also check those
        # The parser stores these as ComponentElementSeparator_16 typically
        if "ComponentElementSeparator_16" in isa:
            sep_field = isa["ComponentElementSeparator_16"]
            if isinstance(sep_field, str) and len(sep_field) >= 1:
                self.subelement_sep = sep_field[0]

    # =========================================================================
    # CORE GENERATION LOGIC
    # =========================================================================

    def generate(self) -> str:
        """
        Main entry point: generates the complete EDI string from the JSON tree.
        
        Returns:
            A properly formatted X12 EDI string with:
            - Dynamically calculated control counts (SE01, GE01, IEA01)
            - Correct segment ordering
            - Proper delimiter usage
        """
        output_segments: list[str] = []

        # ─────────────────────────────────────────────────────────────────────
        # 1. Generate ISA (Interchange Control Header)
        # ─────────────────────────────────────────────────────────────────────
        isa_seg = self._encode_segment(self.envelope.get("ISA", {}))
        if isa_seg:
            output_segments.append(isa_seg)

        # ─────────────────────────────────────────────────────────────────────
        # 2. Generate GS (Functional Group Header)
        # ─────────────────────────────────────────────────────────────────────
        gs_seg = self._encode_segment(self.envelope.get("GS", {}))
        if gs_seg:
            output_segments.append(gs_seg)

        # ─────────────────────────────────────────────────────────────────────
        # 3. Generate ST (Transaction Set Header) — starts segment counting
        # ─────────────────────────────────────────────────────────────────────
        st_seg = self._encode_segment(self.envelope.get("ST", {}))
        if st_seg:
            output_segments.append(st_seg)
            self._segment_count = 1  # ST counts as segment 1

        # ─────────────────────────────────────────────────────────────────────
        # 4. Flatten and encode all loops in correct hierarchical order
        # ─────────────────────────────────────────────────────────────────────
        loop_segments = self._flatten_loops()
        for seg in loop_segments:
            output_segments.append(seg)
            self._segment_count += 1

        # ─────────────────────────────────────────────────────────────────────
        # 5. Generate SE (Transaction Set Trailer) — with dynamic count
        # ─────────────────────────────────────────────────────────────────────
        self._segment_count += 1  # SE itself counts
        se_seg = self._encode_se_segment()
        if se_seg:
            output_segments.append(se_seg)
        self._transaction_count = 1  # We processed one ST/SE pair

        # ─────────────────────────────────────────────────────────────────────
        # 6. Generate GE (Functional Group Trailer) — with dynamic count
        # ─────────────────────────────────────────────────────────────────────
        ge_seg = self._encode_ge_segment()
        if ge_seg:
            output_segments.append(ge_seg)
        self._group_count = 1  # We processed one GS/GE pair

        # ─────────────────────────────────────────────────────────────────────
        # 7. Generate IEA (Interchange Control Trailer) — with dynamic count
        # ─────────────────────────────────────────────────────────────────────
        iea_seg = self._encode_iea_segment()
        if iea_seg:
            output_segments.append(iea_seg)

        # ─────────────────────────────────────────────────────────────────────
        # 8. Join all segments with the segment terminator
        # ─────────────────────────────────────────────────────────────────────
        return self.segment_sep.join(output_segments) + self.segment_sep

    def _flatten_loops(self) -> list[str]:
        """
        Walks through all loops in the correct hierarchical order and
        encodes each segment within them.
        
        Returns:
            List of encoded segment strings (without terminators)
        """
        segments: list[str] = []

        # Determine which loop order to use based on transaction type
        txn_type = self.metadata.get("transaction_type", "837")
        if txn_type == "835":
            loop_order = self.LOOP_ORDER_835
        elif txn_type == "834":
            loop_order = self.LOOP_ORDER_834
        else:
            loop_order = self.LOOP_ORDER_837

        # Also process any loops that exist but aren't in our predefined order
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
                for seg_id, seg_data in instance.items():
                    # Skip Segment_ID marker or envelope segments
                    if seg_id == "Segment_ID" or seg_id in self.ENVELOPE_SEGMENTS:
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
        
        This is where the reverse schema mapping happens:
        - Extracts the segment ID from Segment_ID
        - Parses property names like "TotalClaimChargeAmount_02" to get index 2
        - Places values into the correct element positions
        - Joins sub-elements with the sub-element separator
        
        Args:
            segment: Dictionary with Segment_ID and property_name_NN keys
            
        Returns:
            Encoded segment string (e.g., "CLM*12345*150.00*...")
        """
        if not segment or not isinstance(segment, dict):
            return None

        seg_id = segment.get("Segment_ID", "")
        if not seg_id:
            return None

        # ─────────────────────────────────────────────────────────────────────
        # Build element array by parsing property suffixes (_01, _02, etc.)
        # ─────────────────────────────────────────────────────────────────────
        max_index = 0
        elements_map: dict[int, str] = {}

        for key, value in segment.items():
            if key == "Segment_ID" or key == "raw_data":
                continue

            # Extract the index from the property name suffix (e.g., "_02" → 2)
            index = self._extract_element_index(key)
            if index is None:
                continue

            # Convert value to string, handling sub-elements
            encoded_value = self._encode_element_value(value)
            elements_map[index] = encoded_value
            max_index = max(max_index, index)

        # ─────────────────────────────────────────────────────────────────────
        # Build the ordered elements array
        # ─────────────────────────────────────────────────────────────────────
        elements = [seg_id]
        for i in range(1, max_index + 1):
            elements.append(elements_map.get(i, ""))

        # ─────────────────────────────────────────────────────────────────────
        # Trim trailing empty elements (optional, keeps output cleaner)
        # ─────────────────────────────────────────────────────────────────────
        while len(elements) > 1 and elements[-1] == "":
            elements.pop()

        return self.element_sep.join(elements)

    def _extract_element_index(self, property_name: str) -> Optional[int]:
        """
        Extracts the element index from a property name suffix.
        
        Examples:
            "PatientControlNumber_01" → 1
            "TotalClaimChargeAmount_02" → 2
            "HealthCareServiceInformation_01" → 1
        
        Args:
            property_name: The JSON property key
            
        Returns:
            Integer index or None if not found
        """
        # Match _NN at the end of the property name
        match = re.search(r"_(\d+)$", property_name)
        if match:
            return int(match.group(1))
        return None

    def _encode_element_value(self, value: Any) -> str:
        """
        Encodes a single element value, handling sub-elements.
        
        Args:
            value: Can be a string, number, or list (for sub-elements)
            
        Returns:
            Encoded string value
        """
        if value is None:
            return ""

        # Sub-elements are stored as lists — join with sub-element separator
        if isinstance(value, list):
            return self.subelement_sep.join(str(v) for v in value)

        return str(value)

    # =========================================================================
    # DYNAMIC CONTROL SEGMENT GENERATION
    # =========================================================================

    def _encode_se_segment(self) -> str:
        """
        Generates the SE (Transaction Set Trailer) segment with dynamic count.
        
        SE01: Number of included segments (ST through SE inclusive)
        SE02: Transaction set control number (must match ST02)
        """
        st_seg = self.envelope.get("ST", {})
        
        # SE02 must match ST02 (transaction set control number)
        st_control = (
            st_seg.get("TransactionSetControlNumber_02") or
            st_seg.get("ST02") or
            st_seg.get("ControlNumber_02") or
            "0001"
        )

        # SE01 is the total segment count (dynamically calculated)
        return f"SE{self.element_sep}{self._segment_count}{self.element_sep}{st_control}"

    def _encode_ge_segment(self) -> str:
        """
        Generates the GE (Functional Group Trailer) segment with dynamic count.
        
        GE01: Number of transaction sets included (ST/SE pairs)
        GE02: Group control number (must match GS06)
        """
        gs_seg = self.envelope.get("GS", {})
        
        # GE02 must match GS06 (group control number)
        gs_control = (
            gs_seg.get("GroupControlNumber_06") or
            gs_seg.get("GS06") or
            gs_seg.get("ControlNumber_06") or
            "1"
        )

        # GE01 is the number of transaction sets (ST/SE pairs)
        return f"GE{self.element_sep}{self._transaction_count}{self.element_sep}{gs_control}"

    def _encode_iea_segment(self) -> str:
        """
        Generates the IEA (Interchange Control Trailer) segment with dynamic count.
        
        IEA01: Number of included functional groups (GS/GE pairs)
        IEA02: Interchange control number (must match ISA13)
        """
        isa_seg = self.envelope.get("ISA", {})
        
        # IEA02 must match ISA13 (interchange control number)
        isa_control = (
            isa_seg.get("InterchangeControlNumber_13") or
            isa_seg.get("ISA13") or
            isa_seg.get("ControlNumber_13") or
            "000000001"
        )

        # IEA01 is the number of functional groups (GS/GE pairs)
        return f"IEA{self.element_sep}{self._group_count}{self.element_sep}{isa_control}"

    # =========================================================================
    # UTILITY METHODS
    # =========================================================================

    def get_delimiters(self) -> dict:
        """
        Returns the current delimiter configuration.
        
        Returns:
            Dictionary with element_sep, subelement_sep, segment_sep
        """
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
        """
        Manually override delimiters if needed.
        
        Args:
            element_sep: Element separator (default: *)
            subelement_sep: Sub-element separator (default: :)
            segment_sep: Segment terminator (default: ~)
        """
        if element_sep:
            self.element_sep = element_sep
        if subelement_sep:
            self.subelement_sep = subelement_sep
        if segment_sep:
            self.segment_sep = segment_sep


# ─────────────────────────────────────────────────────────────────────────────
# Convenience function for quick generation
# ─────────────────────────────────────────────────────────────────────────────

def generate_edi(tree: dict, delimiters: dict = None) -> str:
    """
    Convenience function to generate an EDI string from a JSON tree.
    
    Args:
        tree: The parsed EDI JSON tree
        delimiters: Optional dict with element_sep, subelement_sep, segment_sep
        
    Returns:
        Formatted X12 EDI string
    
    Example:
        edi_string = generate_edi(parsed_tree)
        edi_string = generate_edi(parsed_tree, {"segment_sep": "\\n"})
    """
    generator = EDIGenerator(tree)
    
    if delimiters:
        generator.set_delimiters(**delimiters)
    
    return generator.generate()