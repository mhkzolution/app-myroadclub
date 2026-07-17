"use client";

import { useEffect, useState } from "react";

import {
  MEMBER_PROFILE_UPDATED_EVENT,
  getMemberProfile,
  type MemberProfile,
} from "@/lib/wp-profile";

export interface MemberProfileState {
  profile: MemberProfile | null;
  loading: boolean;
  error: unknown;
}

export function useMemberProfile(): MemberProfileState {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = () => {
      getMemberProfile()
        .then((nextProfile) => {
          if (!active) return;
          setProfile(nextProfile);
          setError(null);
        })
        .catch((nextError: unknown) => {
          if (!active) return;
          setError(nextError);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    loadProfile();
    window.addEventListener(MEMBER_PROFILE_UPDATED_EVENT, loadProfile);

    return () => {
      active = false;
      window.removeEventListener(MEMBER_PROFILE_UPDATED_EVENT, loadProfile);
    };
  }, []);

  return { profile, loading, error };
}
