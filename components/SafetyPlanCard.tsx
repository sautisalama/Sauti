"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SafetyItem {
  id: string;
  text: string;
  done?: boolean;
}

interface ContactItem {
  id: string;
  name: string;
  phone: string;
}

export function SafetyPlanCard({ userId }: { userId?: string }) {
  const key = useMemo(() => `safetyPlan_${userId || "anon"}`, [userId]);
  const [items, setItems] = useState<SafetyItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        setItems(parsed.items || []);
        setContacts(parsed.contacts || []);
      }
    } catch (e) {
      // ignore local storage read error
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ items, contacts }));
    } catch (e) {
      // ignore local storage write error
    }
  }, [key, items, contacts]);

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems((prev) => [...prev, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
    setNewItem("");
  };

  const addContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    setContacts((prev) => [...prev, { id: crypto.randomUUID(), name: newContactName.trim(), phone: newContactPhone.trim() }]);
    setNewContactName("");
    setNewContactPhone("");
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <h3 className="font-semibold">Personal Safety Plan</h3>
        <p className="text-xs text-muted-foreground">Only you can see this. Stored on your device.</p>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input placeholder="Add a step (e.g., keep emergency bag ready)" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <Button onClick={addItem}>Add</Button>
        </div>
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!it.done} onChange={(e) => setItems(prev => prev.map(p => p.id === it.id ? { ...p, done: e.target.checked } : p))} />
                <span className={it.done ? "line-through text-muted-foreground" : ""}>{it.text}</span>
              </label>
              <Button variant="ghost" size="sm" onClick={() => setItems(prev => prev.filter(p => p.id !== it.id))}>Remove</Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Trusted contacts</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Name" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
          <Input placeholder="Phone" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} />
          <Button onClick={addContact}>Add</Button>
        </div>
        <ul className="space-y-1 text-sm">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between">
              <span>{c.name} — {c.phone}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => (window.location.href = `tel:${c.phone}`)}>Call</Button>
                <Button variant="ghost" size="sm" onClick={() => setContacts(prev => prev.filter(p => p.id !== c.id))}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => { setItems([]); setContacts([]); }}>Clear</Button>
      </div>
    </div>
  );
}
