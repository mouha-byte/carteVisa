"use client";

import { useEffect } from "react";

import {
  applyLanguageToDocument,
  loadSiteLanguageFromStorage,
  subscribeToSiteLanguage,
  translateDocumentContent,
  type SiteLanguage,
} from "@/app/ui/site-language";

export function SiteLanguageSync() {
  useEffect(() => {
    let currentLanguage: SiteLanguage = loadSiteLanguageFromStorage();
    let frameId: number | null = null;
    let loadTimerId: number | null = null;
    let isApplying = false;
    let isInitialized = false;

    const observer = new MutationObserver(() => {
      scheduleApply();
    });

    function startObserver(): void {
      if (!isInitialized) {
        return;
      }

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder", "title", "aria-label", "value"],
      });
    }

    const apply = () => {
      if (isApplying) {
        return;
      }

      isApplying = true;
      applyLanguageToDocument(currentLanguage);
      translateDocumentContent(currentLanguage);
      isApplying = false;
    };

    const scheduleApply = () => {
      if (!isInitialized) {
        return;
      }

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        apply();
      });
    };

    const initializeTranslation = () => {
      if (isInitialized) {
        return;
      }

      isInitialized = true;

      // Apply after the app has settled to avoid mutating text nodes during hydration.
      frameId = window.requestAnimationFrame(() => {
        frameId = window.requestAnimationFrame(() => {
          frameId = null;
          apply();
          startObserver();
        });
      });
    };

    if (document.readyState === "complete") {
      initializeTranslation();
    } else {
      const onLoad = () => {
        initializeTranslation();
      };

      window.addEventListener("load", onLoad, { once: true });
      loadTimerId = window.setTimeout(() => {
        window.removeEventListener("load", onLoad);
        initializeTranslation();
      }, 1500);
    }

    const unsubscribe = subscribeToSiteLanguage((language) => {
      currentLanguage = language;
      scheduleApply();
    });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      if (loadTimerId !== null) {
        window.clearTimeout(loadTimerId);
      }

      observer.disconnect();
      unsubscribe();
    };
  }, []);

  return null;
}
