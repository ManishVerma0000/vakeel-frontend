"use client"
import React, { useState } from "react";
import { getBackendUrl } from "../config";

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "CLIENT",
  });
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${getBackendUrl()}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.message) {
        setMessage("✅ " + data.message);
      } else {
        setMessage("❌ Registration failed");
      }
    } catch (error:any) {
      setMessage("⚠️ Error: " + error.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-2xl shadow-md w-96"
      >
        <h2 className="text-2xl font-bold mb-4 text-center">Register</h2>

        <label className="block mb-2">Name</label>
        <input
          type="text"
          name="name"
          onChange={handleChange}
          value={formData.name}
          className="w-full p-2 border rounded mb-4"
          required
        />

        <label className="block mb-2">Email</label>
        <input
          type="email"
          name="email"
          onChange={handleChange}
          value={formData.email}
          className="w-full p-2 border rounded mb-4"
          required
        />

        <label className="block mb-2">Password</label>
        <input
          type="password"
          name="password"
          onChange={handleChange}
          value={formData.password}
          className="w-full p-2 border rounded mb-4"
          required
        />

        <label className="block mb-2">Role</label>
        <select
          name="role"
          onChange={handleChange}
          value={formData.role}
          className="w-full p-2 border rounded mb-4"
          required
        >
          <option value="CLIENT">Client</option>
          <option value="LAWYER">Lawyer</option>
        </select>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          Register
        </button>

        {message && <p className="mt-4 text-center">{message}</p>}
      </form>
    </div>
  );
};

export default RegisterPage;
