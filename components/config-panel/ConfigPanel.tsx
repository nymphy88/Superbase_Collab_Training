
import React, { useState, useMemo, useCallback } from "react";
// Fix: Use default export to access WidthProvider and correctly wrap the component
import GridLayout from "react-grid-layout";
import { ConfigToggle, ConfigDropdown, ConfigInput } from "./components";

// Extracting components from the default export to handle environments where named exports are missing
const { WidthProvider, Responsive } = GridLayout as any;
const ResponsiveGridLayout = WidthProvider(Responsive || GridLayout);

const ConfigPanel: React.FC = () => {
  const [layouts, setLayouts] = useState({ lg: [] });

  // ✅ Memoize layouts เพื่อไม่สร้าง object ใหม่ทุกครั้ง
  const memoizedLayouts = useMemo(() => layouts, [layouts]);

  // ✅ Memoize handler และตรวจสอบก่อน setState
  const handleLayoutChange = useCallback(
    (layout: any, allLayouts: any) => {
      // ป้องกันการเรียก setState ซ้ำกับค่าเดิม
      if (JSON.stringify(allLayouts) !== JSON.stringify(layouts)) {
        setLayouts(allLayouts);
      }
    },
    [layouts]
  );

  return (
    <ResponsiveGridLayout
      className="layout"
      cols={12}
      rowHeight={30}
      layouts={memoizedLayouts}
      onLayoutChange={handleLayoutChange}
    >
      <div key="toggle">
        {/* Fix: Corrected prop names to 'enabled' and 'onToggle' */}
        <ConfigToggle label="Enable Feature" enabled={true} onToggle={() => {}} />
      </div>
      <div key="dropdown">
        {/* Fix: Added missing 'label' and converted options to object array */}
        <ConfigDropdown 
          label="Select Mode" 
          options={[{label: "A", value: "A"}, {label: "B", value: "B"}, {label: "C", value: "C"}]} 
          value="A" 
          onChange={() => {}} 
        />
      </div>
      <div key="input">
        {/* Fix: Added missing 'label' and changed value to number */}
        <ConfigInput label="Target Value" value={0} onChange={() => {}} />
      </div>
    </ResponsiveGridLayout>
  );
};

// ✅ ใช้ React.memo กัน re-render ที่ไม่จำเป็น
export default React.memo(ConfigPanel);
