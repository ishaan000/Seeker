import { useState, useEffect } from "react";
import { fetchUser, UserProfile } from "../utils/api";

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchUser(userId)
      .then(setUser)
      .catch((err) => console.error("Failed to fetch user:", err))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
