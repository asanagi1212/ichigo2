import { useEffect, useRef } from "react";

export function useKeyboardCompat({
  activeTab,
  composerRef,
  input,
  messageListRef,
  messages,
  textareaRef
}) {
  const keyboardScrollFrameRef = useRef(0);
  const keyboardScrollTimeoutRef = useRef(0);

  function scrollMessagesToBottom(behavior = "auto") {
    const node = messageListRef.current;
    if (!node) {
      return;
    }

    const previousScrollBehavior = node.style.scrollBehavior;
    node.style.scrollBehavior = behavior;
    node.scrollTop = node.scrollHeight;

    window.requestAnimationFrame(() => {
      node.style.scrollBehavior = previousScrollBehavior;
    });
  }

  function stopKeyboardScrollAssist() {
    if (keyboardScrollFrameRef.current) {
      cancelAnimationFrame(keyboardScrollFrameRef.current);
      keyboardScrollFrameRef.current = 0;
    }

    if (keyboardScrollTimeoutRef.current) {
      window.clearTimeout(keyboardScrollTimeoutRef.current);
      keyboardScrollTimeoutRef.current = 0;
    }
  }

  function startKeyboardScrollAssist() {
    if (activeTab !== "chat") {
      return;
    }

    stopKeyboardScrollAssist();
    let remainingFrames = 3;

    function tickKeyboardScrollAssist() {
      if (document.activeElement !== textareaRef.current) {
        stopKeyboardScrollAssist();
        return;
      }

      scrollMessagesToBottom();
      remainingFrames -= 1;

      if (remainingFrames <= 0) {
        stopKeyboardScrollAssist();
        return;
      }

      keyboardScrollFrameRef.current = window.requestAnimationFrame(tickKeyboardScrollAssist);
    }

    tickKeyboardScrollAssist();
    keyboardScrollTimeoutRef.current = window.setTimeout(() => {
      keyboardScrollTimeoutRef.current = 0;

      if (document.activeElement === textareaRef.current) {
        scrollMessagesToBottom();
      }
    }, 260);
  }

  function handleComposerPointerDown(event) {
    if (event.pointerType === "mouse") {
      return;
    }

    const textareaNode = textareaRef.current;
    if (!textareaNode || document.activeElement === textareaNode) {
      return;
    }

    event.preventDefault();

    try {
      textareaNode.focus({ preventScroll: true });
    } catch {
      textareaNode.focus();
    }

    const caretPosition = textareaNode.value.length;

    try {
      textareaNode.setSelectionRange(caretPosition, caretPosition);
    } catch {}
  }

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }

    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [input, textareaRef]);

  useEffect(() => {
    scrollMessagesToBottom();
  }, [activeTab, messages]);

  useEffect(() => {
    if (activeTab !== "chat") {
      stopKeyboardScrollAssist();
      return;
    }

    const viewport = window.visualViewport;

    function handleFocusIn(event) {
      if (event.target === textareaRef.current) {
        startKeyboardScrollAssist();
      }
    }

    function handleFocusOut(event) {
      if (event.target === textareaRef.current) {
        stopKeyboardScrollAssist();
      }
    }

    function handleViewportChange() {
      if (document.activeElement === textareaRef.current) {
        startKeyboardScrollAssist();
      }
    }

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);
    viewport?.addEventListener("resize", handleViewportChange);

    return () => {
      stopKeyboardScrollAssist();
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      viewport?.removeEventListener("resize", handleViewportChange);
    };
  }, [activeTab, textareaRef]);

  useEffect(() => {
    const root = document.documentElement;
    const composerNode = composerRef.current;
    if (!composerNode) {
      return;
    }

    function syncComposerHeight() {
      root.style.setProperty("--composer-height", `${Math.round(composerNode.offsetHeight)}px`);
    }

    syncComposerHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncComposerHeight) : null;
    resizeObserver?.observe(composerNode);
    window.addEventListener("resize", syncComposerHeight);
    window.visualViewport?.addEventListener("resize", syncComposerHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncComposerHeight);
      window.visualViewport?.removeEventListener("resize", syncComposerHeight);
      root.style.removeProperty("--composer-height");
    };
  }, [activeTab, composerRef]);

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let maxViewportHeight = Math.max(window.innerHeight, viewport?.height || 0);
    let lastAppHeight = -1;
    let lastViewportOffsetTop = -1;
    let lastViewportBottomGap = -1;
    let lastKeyboardOpen = null;

    function syncViewportHeight() {
      const innerHeight = window.innerHeight;
      const viewportHeight = viewport?.height || innerHeight;
      const viewportOffsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));

      maxViewportHeight = Math.max(maxViewportHeight, innerHeight, viewportHeight);

      const keyboardInset = maxViewportHeight - viewportHeight;
      const keyboardOpen = keyboardInset > 120;
      const nextAppHeight = Math.round(viewportHeight);
      const nextViewportOffsetTop = keyboardOpen ? viewportOffsetTop : 0;
      const rawViewportBottomGap = Math.max(0, Math.round(innerHeight - viewportHeight - viewportOffsetTop));
      const nextViewportBottomGap = keyboardOpen ? 0 : rawViewportBottomGap;

      if (nextAppHeight !== lastAppHeight) {
        root.style.setProperty("--app-height", `${nextAppHeight}px`);
        lastAppHeight = nextAppHeight;
      }

      if (nextViewportOffsetTop !== lastViewportOffsetTop) {
        root.style.setProperty("--viewport-offset-top", `${nextViewportOffsetTop}px`);
        lastViewportOffsetTop = nextViewportOffsetTop;
      }

      if (nextViewportBottomGap !== lastViewportBottomGap) {
        root.style.setProperty("--viewport-bottom-gap", `${nextViewportBottomGap}px`);
        lastViewportBottomGap = nextViewportBottomGap;
      }

      if (keyboardOpen !== lastKeyboardOpen) {
        root.dataset.keyboardOpen = keyboardOpen ? "true" : "false";
        lastKeyboardOpen = keyboardOpen;
      }
    }

    function resetViewportBounds() {
      maxViewportHeight = Math.max(window.innerHeight, viewport?.height || 0);
      syncViewportHeight();
    }

    syncViewportHeight();

    if (!viewport) {
      window.addEventListener("resize", syncViewportHeight);
    }

    window.addEventListener("orientationchange", resetViewportBounds);
    window.addEventListener("pageshow", resetViewportBounds);
    viewport?.addEventListener("resize", syncViewportHeight);
    viewport?.addEventListener("scroll", syncViewportHeight);

    return () => {
      if (!viewport) {
        window.removeEventListener("resize", syncViewportHeight);
      }

      window.removeEventListener("orientationchange", resetViewportBounds);
      window.removeEventListener("pageshow", resetViewportBounds);
      viewport?.removeEventListener("resize", syncViewportHeight);
      viewport?.removeEventListener("scroll", syncViewportHeight);
      delete root.dataset.keyboardOpen;
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--viewport-offset-top");
      root.style.removeProperty("--viewport-bottom-gap");
    };
  }, []);

  useEffect(() => {
    function resetWindowScroll() {
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    }

    resetWindowScroll();

    window.addEventListener("scroll", resetWindowScroll, { passive: true });
    window.addEventListener("resize", resetWindowScroll);
    window.addEventListener("focusin", resetWindowScroll);
    window.addEventListener("focusout", resetWindowScroll);

    return () => {
      window.removeEventListener("scroll", resetWindowScroll);
      window.removeEventListener("resize", resetWindowScroll);
      window.removeEventListener("focusin", resetWindowScroll);
      window.removeEventListener("focusout", resetWindowScroll);
    };
  }, []);

  return {
    onComposerPointerDown: handleComposerPointerDown
  };
}
