"use client";

import { useEffect, useState } from "react";

import {
  MEMBER_PROFILE_UPDATED_EVENT,
  getMemberProfile,
  takeIfCurrentGeneration,
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
    let generation = 0;

    const loadProfile = () => {
      const requestGeneration = ++generation;
      setLoading(true);

      getMemberProfile()
        .then((nextProfile) => {
          if (!active) return;
          const accepted = takeIfCurrentGeneration(
            requestGeneration,
            generation,
            nextProfile
          );
          if (accepted === null) return;
          setProfile(accepted);
          setError(null);
        })
        .catch((nextError: unknown) => {
          if (!active) return;
          const accepted = takeIfCurrentGeneration(
            requestGeneration,
            generation,
            nextError
          );
          if (accepted === null) return;
          setError(accepted);
        })
        .finally(() => {
          if (!active) return;
          if (
            takeIfCurrentGeneration(requestGeneration, generation, true) === null
          ) {
            return;
          }
          setLoading(false);
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
