import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Product {
  id: string;
  name: string;
  category: string;
  quantity: number;
  expiry_date: string;
  avg_daily_sales: number;
  price: number;
}

const categories = ["Mlečni proizvodi", "Meso", "Voće i povrće", "Pekarski", "Konzerve", "Ostalo"];

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "Ostalo",
    quantity: 0,
    expiry_date: "",
    avg_daily_sales: 0,
    price: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, role } = useAuth();

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("expiry_date", { ascending: true });
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("products").insert({
      ...form,
      created_by: user?.id,
    });
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Proizvod dodat!" });
      setDialogOpen(false);
      setForm({ name: "", category: "Ostalo", quantity: 0, expiry_date: "", avg_daily_sales: 0, price: 0 });
      fetchProducts();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      fetchProducts();
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const obj: any = {};
      headers.forEach((h, i) => (obj[h] = values[i]));
      return {
        name: obj["naziv"] || obj["name"] || "",
        category: obj["kategorija"] || obj["category"] || "Ostalo",
        quantity: parseInt(obj["kolicina"] || obj["quantity"] || "0"),
        expiry_date: obj["rok"] || obj["expiry_date"] || obj["datum_isteka"] || "",
        avg_daily_sales: parseFloat(obj["prodaja"] || obj["avg_daily_sales"] || "0"),
        price: parseFloat(obj["cena"] || obj["price"] || "0"),
        created_by: user?.id,
      };
    }).filter((r) => r.name && r.expiry_date);

    if (rows.length === 0) {
      toast({ title: "Greška", description: "CSV fajl nema validnih redova", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("products").insert(rows);
    if (error) {
      toast({ title: "Greška pri uvozu", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Uvezeno ${rows.length} proizvoda!` });
      fetchProducts();
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Proizvodi</h1>
          <p className="text-muted-foreground mt-1">Upravljajte inventarom</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleCSVImport}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Uvezi CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj proizvod
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novi proizvod</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Naziv</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kategorija</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Količina</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cena (RSD)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Datum isteka</Label>
                    <Input
                      type="date"
                      value={form.expiry_date}
                      onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prosečna dnevna prodaja</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.avg_daily_sales}
                      onChange={(e) =>
                        setForm({ ...form, avg_daily_sales: parseFloat(e.target.value) || 0 })
                      }
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Sačuvaj
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naziv</TableHead>
              <TableHead>Kategorija</TableHead>
              <TableHead className="text-right">Količina</TableHead>
              <TableHead className="text-right">Cena</TableHead>
              <TableHead>Rok trajanja</TableHead>
              <TableHead className="text-right">Dnevna prodaja</TableHead>
              {role === "manager" && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Učitavanje...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nema proizvoda. Dodajte prvi proizvod ili uvezite CSV.
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => {
                const daysLeft = Math.ceil(
                  (new Date(p.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const isRisk = daysLeft <= 3 && daysLeft >= 0;
                const isExpired = daysLeft < 0;
                return (
                  <TableRow key={p.id} className={isExpired ? "opacity-50" : isRisk ? "bg-warning/5" : ""}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-right">{p.quantity}</TableCell>
                    <TableCell className="text-right">{Number(p.price).toFixed(2)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isExpired
                            ? "bg-destructive/10 text-destructive"
                            : isRisk
                            ? "bg-warning/10 text-warning"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {isExpired
                          ? "Istekao"
                          : daysLeft === 0
                          ? "Danas ističe"
                          : `${daysLeft} dana`}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{Number(p.avg_daily_sales).toFixed(1)}</TableCell>
                    {role === "manager" && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(p.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
