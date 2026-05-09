<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Register Number</th>
      <th>Batch</th>
      <th>Branch</th>
      <th>Total Points</th>
    </tr>
  </thead>
  <tbody>
    {students.map(s => (
      <tr key={s._id}>
        <td>{s.name}</td>
        <td>{s.registerNumber}</td>
        <td>{s.batch}</td>
        <td>{s.branch}</td>
        <td>{s.totalPoints}</td>
      </tr>
    ))}
  </tbody>
</table>
