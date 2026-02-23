import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { TrendingDown, Heart } from "lucide-react";

interface HistoryEntry {
  id: string;
  action_type: string;
  discount_percentage: number | null;
  reason: string | null;
  created_at: string;
  products: {
    name: string;
    category: string;
  } | null;
}

export default function ActionHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("action_history")
        .select("*, products(name, category)")
        .order("created_at", { ascending: false });

      setHistory((data as any[]) ?? []);
      setLoading(false);
    }
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Istorija akcija</h1>
        <p className="text-muted-foreground mt-1">Evidencija svih odluka</p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proizvod</TableHead>
              <TableHead>Kategorija</TableHead>
              <TableHead>Akcija</TableHead>
              <TableHead>Detalji</TableHead>
              <TableHead>Obrazloženje</TableHead>
              <TableHead>Datum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Učitavanje...
                </TableCell>
              </TableRow>
            ) : history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nema zabeleženih akcija.
                </TableCell>
              </TableRow>
            ) : (
              history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">
                    {h.products?.name ?? "Obrisan proizvod"}
                  </TableCell>
                  <TableCell>{h.products?.category ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={h.action_type === "discount" ? "default" : "destructive"}>
                      {h.action_type === "discount" ? (
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
                  </TableCell>
                  <TableCell>
                    {h.action_type === "discount" && h.discount_percentage
                      ? `${h.discount_percentage}% popust`
                      : h.action_type === "donation"
                      ? "Za donaciju"
                      : "-"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {h.reason ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(h.created_at), "dd. MMM yyyy, HH:mm")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
