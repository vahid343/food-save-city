import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, TrendingDown, Heart, Check } from "lucide-react";

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
}

export default function RiskZone() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [discountPercent, setDiscountPercent] = useState(30);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    async function analyze() {
      const today = new Date();
      const riskDate = new Date();
      riskDate.setDate(today.getDate() + 5);

      const { data: products } = await supabase
        .from("products")
        .select("*")
        .lte("expiry_date", riskDate.toISOString().split("T")[0])
        .gte("expiry_date", today.toISOString().split("T")[0])
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true });

      if (!products) {
        setLoading(false);
        return;
      }

      const results: Suggestion[] = (products as Product[]).map((p) => {
        const daysLeft = Math.ceil(
          (new Date(p.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        const expectedSales = Number(p.avg_daily_sales) * daysLeft;
        const surplus = p.quantity - expectedSales;

        let action: "discount" | "donation";
        let reason: string;

        if (surplus > 0 && daysLeft >= 2 && Number(p.avg_daily_sales) > 0) {
          action = "discount";
          reason = `Preostalo ${daysLeft} dana; višak od ${Math.round(surplus)} kom. iznad očekivane prodaje. Sniženje može ubrzati prodaju.`;
        } else {
          action = "donation";
          reason =
            daysLeft <= 1
              ? `Ističe ${daysLeft === 0 ? "danas" : "sutra"}; prodaja malo verovatna u preostalom vremenu.`
              : `Preostalo ${daysLeft} dana; niska prosečna prodaja (${Number(p.avg_daily_sales).toFixed(1)}/dan) za ${p.quantity} kom. na stanju.`;
        }

        return { product: p, action, reason, daysLeft };
      });

      setSuggestions(results);
      setLoading(false);
    }

    analyze();
  }, []);

  const handleConfirm = async (suggestion: Suggestion, actionType: "discount" | "donation") => {
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

    // If donation, set quantity to 0
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

    setSuggestions((prev) => prev.filter((s) => s.product.id !== suggestion.product.id));
    setSelectedSuggestion(null);
    setDiscountPercent(30);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-8 w-8 text-warning" />
          Rizična zona
        </h1>
        <p className="text-muted-foreground mt-1">
          Proizvodi kojima ističe rok u narednih 5 dana
        </p>
      </div>

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
                    variant={s.action === "discount" ? "default" : "destructive"}
                    className="shrink-0"
                  >
                    {s.action === "discount" ? (
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
                    <span
                      className={`font-medium ${
                        s.daysLeft <= 1 ? "text-destructive" : "text-warning"
                      }`}
                    >
                      {s.daysLeft === 0 ? "Danas" : `${s.daysLeft} dana`}
                    </span>
                  </div>
                </div>

                <p className="text-sm bg-muted/50 p-3 rounded-lg">{s.reason}</p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
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
