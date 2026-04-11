"use client";

import React from "react";

interface UserAvatarProps {
  avatarURL?: string;
  name?: string | null;
  className?: string;
  iconSize?: string;
}

import { useTranslations } from "next-intl";

export const UserAvatar = ({
  avatarURL,
  name,
  className = "w-full h-full",
  iconSize = "text-xl md:text-2xl",
}: UserAvatarProps) => {
  const t = useTranslations("common.navbar");

  if (avatarURL) {
    return (
      <img
        src={avatarURL}
        alt={name || t("user")}
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-zinc-800`}
    >
      <span className={`material-symbols-outlined text-zinc-400 ${iconSize}`}>
        account_circle
      </span>
    </div>
  );
};
