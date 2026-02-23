import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, TrendingDown, Heart, Check } from "lucide-react";
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

interface Suggestion {
  product: Product;
  action: "discount" | "donation";
  reason: string;
  daysLeft: number;
  isDonated?: boolean;
}

interface HistoryEntry {
  id: string;
  action_type: string;
  discount_percentage: number | null;
  reason: string | null;
  created_at: string;
  products: { name: string; category: string } | null;
}

export default function RiskZone() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [discountedItems, setDiscountedItems] = useState<HistoryEntry[]>([]);
  const [donatedItems, setDonatedItems] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [discountPercent, setDiscountPercent] = useState(30);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    const today = new Date();
    const riskDate = new Date();
    riskDate.setDate(today.getDate() + 5);

    // Fetch risk products, discounted history, donated history, and donated product IDs in parallel
    const [productsRes, discountedRes, donatedRes] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .lte("expiry_date", riskDate.toISOString().split("T")[0])
        .gte("expiry_date", today.toISOString().split("T")[0])
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true }),
      supabase
        .from("action_history")
        .select("*, products(name, category)")
        .eq("action_type", "discount")
        .order("created_at", { ascending: false }),
      supabase
        .from("action_history")
        .select("*, products(name, category)")
        .eq("action_type", "donation")
        .order("created_at", { ascending: false }),
    ]);

    // Set history lists
    setDiscountedItems((discountedRes.data as HistoryEntry[]) ?? []);
    setDonatedItems((donatedRes.data as HistoryEntry[]) ?? []);

    // Build set of donated product IDs
    const donatedProductIds = new Set(
      (donatedRes.data ?? []).map((d: any) => d.product_id)
    );

    const products = productsRes.data as Product[] | null;
    if (!products) {
      setLoading(false);
      return;
    }

    const results: Suggestion[] = products.map((p) => {
      const daysLeft = Math.ceil(
        (new Date(p.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      const expectedSales = Number(p.avg_daily_sales) * daysLeft;
      const surplus = p.quantity - expectedSales;
      const isDonated = donatedProductIds.has(p.id);

      let action: "discount" | "donation";
      let reason: string;

      if (isDonated) {
        action = "donation";
        reason = "Ovaj proizvod je već doniran.";
      } else if (surplus > 0 && daysLeft >= 2 && Number(p.avg_daily_sales) > 0) {
        action = "discount";
        reason = `Preostalo ${daysLeft} dana; višak od ${Math.round(surplus)} kom. iznad očekivane prodaje. Sniženje može ubrzati prodaju.`;
      } else {
        action = "donation";
        reason =
          daysLeft <= 1
            ? `Ističe ${daysLeft === 0 ? "danas" : "sutra"}; prodaja malo verovatna u preostalom vremenu.`
            : `Preostalo ${daysLeft} dana; niska prosečna prodaja (${Number(p.avg_daily_sales).toFixed(1)}/dan) za ${p.quantity} kom. na stanju.`;
      }

      return { product: p, action, reason, daysLeft, isDonated };
    });

    setSuggestions(results);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleConfirm = async (suggestion: Suggestion, actionType: "discount" | "donation") => {
    if (suggestion.isDonated && actionType === "discount") {
      toast({ title: "Greška", description: "Donirani proizvod ne može biti snižen.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("action_history").insert({
      product_id: suggestion.product.id,
      action_type: actionType,
      discount_percentage: actionType === "discount" ? discountPercent : null,
      reason: suggestion.reason,
      decided_by: user?.id,
    });

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      return;
    }

    if (actionType === "donation") {
      await supabase
        .from("products")
        .update({ quantity: 0 })
        .eq("id", suggestion.product.id);
    }

    toast({
      title: actionType === "discount" ? "Sniženje potvrđeno!" : "Donacija označena!",
      description: `${suggestion.product.name} - ${actionType === "discount" ? `${discountPercent}% popust` : "pripremljeno za donaciju"}`,
    });

    setSelectedSuggestion(null);
    setDiscountPercent(30);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-8 w-8 text-warning" />
          Rizična zona
        </h1>
        <p className="text-muted-foreground mt-1">
          Proizvodi kojima ističe rok i istorija akcija
        </p>
      </div>

      <Tabs defaultValue="risk" className="w-full">
        <TabsList>
          <TabsTrigger value="risk">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Rizični ({suggestions.length})
          </TabsTrigger>
          <TabsTrigger value="discounted">
            <TrendingDown className="h-4 w-4 mr-1" />
            Sniženi ({discountedItems.length})
          </TabsTrigger>
          <TabsTrigger value="donated">
            <Heart className="h-4 w-4 mr-1" />
            Donirani ({donatedItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="risk" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Analiza u toku...</p>
          ) : suggestions.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-12 text-center">
                <Check className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-heading text-xl font-semibold">Sve je u redu!</h3>
                <p className="text-muted-foreground mt-2">Nema proizvoda u rizičnoj zoni.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((s) => (
                <Card key={s.product.id} className="shadow-card hover:shadow-soft transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{s.product.name}</CardTitle>
                      <Badge
                        variant={s.isDonated ? "secondary" : s.action === "discount" ? "default" : "destructive"}
                        className="shrink-0"
                      >
                        {s.isDonated ? (
                          <>
                            <Heart className="h-3 w-3 mr-1" />
                            Doniran
                          </>
                        ) : s.action === "discount" ? (
                          <>
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Sniženje
                          </>
                        ) : (
                          <>
                            <Heart className="h-3 w-3 mr-1" />
                            Donacija
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{s.product.category}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Količina:</span>{" "}
                        <span className="font-medium">{s.product.quantity}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rok:</span>{" "}
                        <span className={`font-medium ${s.daysLeft <= 1 ? "text-destructive" : "text-warning"}`}>
                          {s.daysLeft === 0 ? "Danas" : `${s.daysLeft} dana`}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm bg-muted/50 p-3 rounded-lg">{s.reason}</p>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={s.isDonated}
                        onClick={() => {
                          setSelectedSuggestion(s);
                          setDiscountPercent(30);
                        }}
                      >
                        <TrendingDown className="h-4 w-4 mr-1" />
                        Sniži
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={s.isDonated}
                        onClick={() => handleConfirm(s, "donation")}
                      >
                        <Heart className="h-4 w-4 mr-1" />
                        Doniraj
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="discounted" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Učitavanje...</p>
          ) : discountedItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nema sniženih artikala.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proizvod</TableHead>
                    <TableHead>Kategorija</TableHead>
                    <TableHead className="text-right">Popust</TableHead>
                    <TableHead>Razlog</TableHead>
                    <TableHead>Datum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discountedItems.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.products?.name ?? "—"}</TableCell>
                      <TableCell>{h.products?.category ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="default">{h.discount_percentage}%</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {h.reason ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(h.created_at), "dd. MMM yyyy, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="donated" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Učitavanje...</p>
          ) : donatedItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nema doniranih artikala.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proizvod</TableHead>
                    <TableHead>Kategorija</TableHead>
                    <TableHead>Razlog</TableHead>
                    <TableHead>Datum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donatedItems.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.products?.name ?? "—"}</TableCell>
                      <TableCell>{h.products?.category ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {h.reason ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(h.created_at), "dd. MMM yyyy, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedSuggestion} onOpenChange={() => setSelectedSuggestion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potvrda sniženja - {selectedSuggestion?.product.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{selectedSuggestion?.reason}</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Procenat sniženja (%)</label>
              <Input
                type="number"
                min={5}
                max={90}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 30)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => selectedSuggestion && handleConfirm(selectedSuggestion, "discount")}
              >
                Potvrdi sniženje od {discountPercent}%
              </Button>
              <Button variant="outline" onClick={() => setSelectedSuggestion(null)}>
                Otkaži
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
