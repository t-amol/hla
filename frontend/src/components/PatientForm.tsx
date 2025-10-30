import React, { useState } from "react";
import { z } from "zod";

const PatientSchema = z.object({
  patient_id: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  gender: z.enum(["male","female","other"]),
  birth_date: z.string(),
  address: z.string().optional()
});
type Patient = z.infer<typeof PatientSchema>;

export default function PatientForm(){
  const [form, setForm] = useState<Patient>({patient_id:"",first_name:"",last_name:"",gender:"male",birth_date:""});
  const [error, setError] = useState<string>("");
  async function submit(){
    const parsed = PatientSchema.safeParse(form);
    if(!parsed.success){ setError(parsed.error.errors[0].message); return; }
    await fetch("/api/patients/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    setError("");
    alert("Saved!");
  }
  return (
    <div style={{display:"grid", gap:8, maxWidth:480}}>
      <input placeholder="ID" value={form.patient_id} onChange={e=>setForm({...form,patient_id:e.target.value})}/>
      <input placeholder="First" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/>
      <input placeholder="Last" value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/>
      <select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value as any})}>
        <option value="male">male</option>
        <option value="female">female</option>
        <option value="other">other</option>
      </select>
      <input placeholder="Birth YYYY-MM-DD" value={form.birth_date} onChange={e=>setForm({...form,birth_date:e.target.value})}/>
      <button onClick={submit}>Save</button>
      {error && <p style={{color:"red"}}>{error}</p>}
    </div>
  );
}
