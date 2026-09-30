export default function Card({ title, value }) {
  return (
    <div style={{
      background: "#f9fafb",
      padding: 20,
      borderRadius: 8,
      minWidth: 200,
      boxShadow: "0 1px 4px rgba(0,0,0,0.1)"
    }}>
      <h4>{title}</h4>
      <strong style={{ fontSize: 24 }}>{value}</strong>
    </div>
  );
}
