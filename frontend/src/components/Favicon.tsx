"use client";

import React, { useState } from "react";

interface FaviconProps {
  url: string;
}

export const Favicon: React.FC<FaviconProps> = ({ url }) => {
  const [hasError, setHasError] = useState(false);

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    return (
      <div className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center overflow-hidden">
        <span className="material-symbols-outlined text-[10px] text-zinc-400">
          public
        </span>
      </div>
    );
  }

  return (
    <div className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center overflow-hidden">
      {!hasError ? (
        <img
          src={`https://${hostname}/favicon.ico`}
          alt=""
          className="w-full h-full object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="material-symbols-outlined text-[10px] text-zinc-400">
          public
        </span>
      )}
    </div>
  );
};
