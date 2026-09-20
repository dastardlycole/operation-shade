import { route } from "@/lib/router";
import { QuizLink, ShareButton } from "./share-actions";

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

export default async function SharePage({ searchParams }: PageProps<"/share">) {
  const p = await searchParams;
  const skin = p.skin as string | undefined;
  const routine = p.routine as string | undefined;
  const budget = p.budget as string | undefined;
  const finish = p.finish as string | undefined;

  const result = route({ skin, routine, budget, finish });

  const headline =
    [
      skin ? SKIN_LABELS[skin] : null,
      budget ? BUDGET_LABELS[budget] : null,
      finish ? FINISH_LABELS[finish] : null,
    ]
      .filter(Boolean)
      .join(". ") + ".";

  const productSummary =
    result?.products.map((p) => `${p.name} £${p.price}`).join(", ") ?? "";
  const verdictUrl = `/verdict?${new URLSearchParams(p as Record<string, string>)}`;

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-5 py-10">
      {/* Dark shareable card */}
      <div className="w-full max-w-sm bg-ink text-white p-6 mb-4">
        <div className="flex justify-between items-center mb-5">
          <span className="text-[10px] tracking-[0.15em] text-terra uppercase">
            Maya Rao&apos;s Verdict
          </span>
          <span className="text-[10px] text-white/35">4 questions</span>
        </div>

        <h2 className="font-serif text-[2rem] leading-tight mb-5">{headline}</h2>

        <div className="border-t border-white/15 pt-4 flex flex-col gap-3">
          {result?.products.map((product) => (
            <div key={product.ref}>
              <div className="flex justify-between items-baseline">
                <span className="font-serif text-lg">{product.name}</span>
                <span className="text-xs text-white/45">
                  £{product.price} · {product.rating}
                </span>
              </div>
              <p className="text-sm italic text-white/55 mt-0.5">
                &ldquo;{product.note}&rdquo;
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-white/15 pt-4 mt-4 flex justify-between items-center">
          <span className="text-xs text-white/35">Get your own in four taps</span>
          <QuizLink />
        </div>
      </div>

      <ShareButton
        headline={headline}
        products={productSummary}
        verdictUrl={verdictUrl}
      />
    </div>
  );
}
