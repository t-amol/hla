import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function ChartsDashboard(){
  const [rows,setRows]=useState<any[]>([]);
  useEffect(()=>{
    fetch("/api/observations/?code=BP_SYS").then(r=>r.json()).then(setRows);
  },[]);
  return (
    <div>
      <h3>Average BP by time</h3>
      <LineChart width={800} height={300} data={rows}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="effective_time"/>
        <YAxis/>
        <Tooltip/>
        <Line type="monotone" dataKey="value" />
      </LineChart>
    </div>
  );
}
