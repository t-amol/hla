import React from "react";
import PatientForm from "./components/PatientForm";
import ChartsDashboard from "./components/ChartsDashboard";

export default function App(){
  return (
    <div style={{padding:16}}>
      <h2>Healthcare Analytics</h2>
      <PatientForm />
      <div style={{height:24}} />
      <ChartsDashboard />
    </div>
  );
}
