"use client";

import React from "react";

interface UserAvatarProps {
  avatarURL?: string;
  name?: string | null;
  className?: string;
  iconSize?: string;
}

export const UserAvatar = ({
  avatarURL,
  name,
  className = "w-full h-full",
  iconSize = "text-xl md:text-2xl",
}: UserAvatarProps) => {
  if (avatarURL) {
    return (
      <img
        src={avatarURL}
        alt={name || "User"}
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
