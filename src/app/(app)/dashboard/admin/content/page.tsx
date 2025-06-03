"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Edit, Trash2, PlusCircle, Save, X } from "lucide-react";

interface ContentItem {
  id?: string;
  title: string;
  description: string;
  body: string;
  createdAt: Timestamp | null;
}

export default function ContentAdminPage() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [form, setForm] = useState<Omit<ContentItem, "id" | "createdAt">>({ title: "", description: "", body: "" });
  
  useEffect(() => {
    fetchContents();
  }, []);

  async function fetchContents() {
    setLoading(true);
    setError(null);
    try {
      const col = collection(db, "contents");
      const snap = await getDocs(col);
      const items = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ContentItem));
      setContents(items);
    } catch (err: any) {
      setError("Failed to load content.");
    } finally {
      setLoading(false);
    }
  }

  function openForm(item?: ContentItem) {
    if (item) {
      setEditItem(item);
      setForm({ title: item.title, description: item.description, body: item.body });
    } else {
      setEditItem(null);
      setForm({ title: "", description: "", body: "" });
    }
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editItem && editItem.id) {
        await updateDoc(doc(db, "contents", editItem.id), {
          ...form,
        });
      } else {
        await addDoc(collection(db, "contents"), {
          ...form,
          createdAt: Timestamp.now(),
        });
      }
      setShowForm(false);
      fetchContents();
    } catch (err) {
      setError("Failed to save content.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this content?")) return;
    try {
      await deleteDoc(doc(db, "contents", id));
      fetchContents();
    } catch (err) {
      setError("Failed to delete content.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="font-headline text-3xl font-bold tracking-tight">Content Management</h1>
        <Button className="ml-auto" onClick={() => openForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add Content</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Content List</CardTitle>
          <CardDescription>Manage all content entries in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-destructive flex items-center gap-2">{error}</div>
          ) : contents.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No content found.</p>
          ) : (
            <div className="space-y-4">
              {contents.map(item => (
                <Card key={item.id} className="border p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-lg">{item.title}</div>
                      <div className="text-xs text-muted-foreground mb-1">{item.description}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" onClick={() => openForm(item)}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="destructive" onClick={() => item.id && handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm line-clamp-3">{item.body}</div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>{editItem ? "Edit Content" : "Add Content"}</CardTitle>
            </CardHeader>
            <form onSubmit={handleSave}>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Title"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  required
                />
                <Textarea
                  placeholder="Content body..."
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  rows={6}
                  required
                />
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}><X className="h-4 w-4" /> Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground"><Save className="h-4 w-4 mr-2" /> Save</Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
} 