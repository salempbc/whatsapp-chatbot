"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("/api/members")
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <div>
      <h1>Members</h1>
      {data.map((m: any) => (
        <div key={m._id}>
          {m.name} ({m.gender})
        </div>
      ))}
    </div>
  );
}