import Link from "next/link";
import { redirect } from "next/navigation";
import { route } from "@/lib/router";

const SKIN_LABELS: Record<string, string> = {
  dry: "Dry skin",
  oily: "Oily / combo skin",
  sensitive: "Sensitive skin",
  redness: "Redness",
};
const BUDGET_LABELS: Record<string, string> = {
  "under-30": "Under £30",
  "30-60": "£30–60",
  "60-plus": "£60+",
};
const FINISH_LABELS: Record<string, string> = {
  rich: "Rich",
  light: "Light",
  glow: "Glow",
  invisible: "Invisible",
};

export default async function VerdictPage({ searchParams }: PageProps<"/verdict">) {
  const p = await searchParams;
  const skin = p.skin as string | undefined;
  const routine = p.routine as string | undefined;
  const budget = p.budget as string | undefined;
  const finish = p.finish as string | undefined;

  if (!skin || !budget) redirect("/quiz");
  if (skin === "not-sure") redirect("/escape?skin=not-sure");

  const result = route({ skin, routine, budget, finish });
  if (!result) redirect(`/escape?${new URLSearchParams(p as Record<string, string>)}`);

  const headline =
    [SKIN_LABELS[skin], BUDGET_LABELS[budget], finish ? FINISH_LABELS[finish] : null]
      .filter(Boolean)
      .join(". ") + ".";

  const shownNames = result!.products.map((p) => p.name).join(" + ");
  const escapeQ = new URLSearchParams({
    ...(p as Record<string, string>),
    shown: shownNames,
  });
  const shareQ = new URLSearchParams(p as Record<string, string>);

  return (
    <div className="min-h-screen bg-cream flex justify-center">
      <div className="w-full max-w-sm px-5 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/quiz" className="text-ink text-lg" aria-label="Back">
            ‹
          </Link>
          <span className="text-[10px] tracking-[0.15em] text-terra uppercase font-sans">
            Maya's Verdict
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-serif text-[2rem] leading-tight text-ink mb-6">
          {headline}
        </h1>

        {/* Budget note */}
        {result!.budgetNote && (
          <p className="text-sm text-ink/55 mb-4 leading-relaxed">
            {result!.budgetNote}
          </p>
        )}

        {/* Fragrance warning */}
        {result!.fragranceWarning && (
          <p className="text-xs text-terra mb-4 uppercase tracking-wide">
            Avoid fragrance — check every label.
          </p>
        )}

        {/* Product cards */}
        <div className="flex flex-col gap-3 mb-6">
          {result!.products.map((product) => (
            <div
              key={product.ref}
              className="bg-white border border-ink/[0.12] p-4"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] tracking-[0.15em] text-terra uppercase">
                  {product.ref === "E-04.5" ? "Every verdict" : product.type}
                </span>
                <span className="text-xs text-ink/50">Maya {product.rating}</span>
              </div>
              <div className="flex justify-between items-baseline mt-0.5">
                <span className="font-serif text-xl text-ink">{product.name}</span>
                <span className="text-sm text-ink/60">£{product.price}</span>
              </div>
              <p className="text-sm italic text-ink/60 mt-1">"{product.note}"</p>
            </div>
          ))}

          {/* Declined products */}
          {result!.declinedProducts.map((product) => (
            <div
              key={product.ref}
              className="bg-white border border-dashed border-terra p-4"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] tracking-[0.15em] text-terra uppercase">
                  Maya says no
                </span>
                <span className="text-xs text-ink/50">Maya {product.rating}</span>
              </div>
              <div className="flex justify-between items-baseline mt-0.5">
                <span className="font-serif text-xl text-ink line-through">
                  {product.name}
                </span>
                <span className="text-sm text-ink/60">£{product.price}</span>
              </div>
              <p className="text-sm italic text-ink/60 mt-1">"{product.note}"</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <Link
          href={`/share?${shareQ}`}
          className="block w-full text-center bg-ink text-white py-4 text-sm font-sans mb-4"
        >
          Send this to a friend
        </Link>
        <p className="text-center">
          <Link
            href={`/escape?${escapeQ}`}
            className="text-sm text-ink/50 underline underline-offset-2"
          >
            Still not sure? Write to Maya
          </Link>
        </p>
      </div>
    </div>
  );
}
