import { usePatients } from "@/lib/store";

export function HandoffMap() {
  const { patients } = usePatients();

  return (
    <div>
      <h2>Mapa</h2>
      {patients.map((p) => (
        <div key={p.id}>{p.bed} - {p.name}</div>
      ))}
    </div>
  );
}
