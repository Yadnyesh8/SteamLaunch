/**
 * Steam Store + X share + optional Pump.fun when the game has a registered mint.
 * Icons: /public/icons/steam_icon.png, x_icon.png, pumpfun_icon.png
 */
export function GamePageExternalLinks({
  steamAppId,
  gameName,
  sharePageUrl,
  pumpFunMintAddress,
}: {
  steamAppId: number;
  gameName: string;
  sharePageUrl: string;
  /** When set (launched token), shows Pump.fun link to the coin page. */
  pumpFunMintAddress?: string | null;
}) {
  const steamStoreUrl = `https://store.steampowered.com/app/${steamAppId}/`;
  const tweet = `${gameName} — Steam Fund`;
  const xIntentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(sharePageUrl)}`;
  const mint = pumpFunMintAddress?.trim() ?? "";
  const pumpFunUrl = mint ? `https://pump.fun/coin/${encodeURIComponent(mint)}` : null;

  return (
    <div className="steam-game-external-links" role="group" aria-label="External links">
      <a
        href={steamStoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="steam-icon-link"
        title="View on Steam"
        aria-label={`${gameName} on Steam Store`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/steam_icon.png" alt="" width={20} height={20} />
      </a>
      <a
        href={xIntentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="steam-icon-link"
        title="Share on X"
        aria-label={`Share ${gameName} on X`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/x_icon.png" alt="" width={20} height={20} />
      </a>
      {pumpFunUrl ? (
        <a
          href={pumpFunUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="steam-icon-link steam-icon-link--pump"
          title="View on Pump.fun"
          aria-label={`${gameName} on Pump.fun`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/pumpfun_icon.png"
            alt=""
            width={20}
            height={20}
            className="steam-icon-link-img-pump"
          />
        </a>
      ) : null}
    </div>
  );
}
