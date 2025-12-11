import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useStore } from "../store/StoreProvider.jsx"
import { useNavigate } from "react-router-dom";
import { formatNumber } from "../utils/index.ts";

const MOVEMENT_RESET_DELAY = 600;
const LAUNCH_THRESHOLD = 800_000;

const selectTopTokens = (tokens) =>
  tokens.slice().sort((a, b) => b.totalPledged - a.totalPledged).slice(0, 10);

const buildRankMap = (tokens) =>
  tokens.reduce((acc, token, index) => {
    acc[token.id] = index;
    return acc;
  }, {});

const buildRowClass = (movements, tokenId) => 
  [
    "leaderboard-row",
    movements[tokenId] === "up" && "leaderboard-row--up",
    movements[tokenId] === "down" && "leaderboard-row--down",
    movements[tokenId] === "launch" && "leaderboard-row--launch",
  ].filter(Boolean).join(" ");


const detectMovements = (current, prevRanks) => 
  current.reduce((acc, token, idx) => {
    const prevIdx = prevRanks[token.id];
    if (prevIdx !== undefined && prevIdx !== idx) {
      acc[token.id] = prevIdx > idx ? "up" : "down";
    }
    return acc;
  }, {});

const pickSwapPair = (tokens) => {
  if (tokens.length < 2) return null;
  const upperIndex = Math.max(0, Math.min(4, tokens.length - 2));
  const elonToken = tokens.find(token => token.name === 'ELON');
  const ai16zToken = tokens.find(token => token.name === 'AI16Z');

  return { upper: ai16zToken, lower: elonToken };
};

const pickLaunchCandidate = (tokens) =>
  tokens.find(token => token.totalPledged >= LAUNCH_THRESHOLD && token.status === "active");

const useMovementTracking = (tokens, movements, setMovements, prevRanksRef) => {
  useEffect(() => {
    const rankMap = buildRankMap(tokens);
    setMovements(detectMovements(tokens, prevRanksRef.current));
    prevRanksRef.current = rankMap;
  }, [tokens, setMovements, prevRanksRef]);

  useEffect(() => {
    if (!Object.keys(movements).length) return;
    const timer = setTimeout(() => setMovements({}), MOVEMENT_RESET_DELAY);
    return () => clearTimeout(timer);
  }, [movements, setMovements]);
};

const useSwapDemo = (tokens, addPledge, swapDemoRef) => {
  useEffect(() => {
    if (swapDemoRef.current) return;

    const pair = pickSwapPair(tokens);
    if (!pair?.upper || !pair.lower) return;

    const delta = Math.max(10, pair.upper.totalPledged - pair.lower.totalPledged + 5000);
    const timer = setTimeout(() => {
      addPledge(pair.lower.id, delta);
      swapDemoRef.current = true;
    }, 2000);

    return () => clearTimeout(timer);
  }, [tokens, addPledge, swapDemoRef]);
};

const useTopLaunchDemo = (leader, addPledgeRef, launchCampaignRef, launchDemoRef, setMovements) => {
  useEffect(() => {
    if (launchDemoRef.current || !leader || leader.status !== "active") return;

    const leaderId = leader.id;
    const boostDelta = Math.max(0, LAUNCH_THRESHOLD - leader.totalPledged + 50);
    const boostTimer = setTimeout(() => addPledgeRef.current(leaderId, boostDelta), 6000);

    let removalTimer;
    const launchTimer = setTimeout(() => {
      setMovements(prev => ({ ...prev, [leaderId]: "launch" }));
      removalTimer = setTimeout(() => {
        launchCampaignRef.current(leaderId);
        launchDemoRef.current = true;
      }, MOVEMENT_RESET_DELAY);
    }, 7000);

    return () => {
      clearTimeout(boostTimer);
      clearTimeout(launchTimer);
      if (removalTimer) clearTimeout(removalTimer);
    };
  }, [leader?.id, leader?.status, launchDemoRef, setMovements]);
};

export const LeaderboardPage = () => {
  const { getTokens, getTokenByName, addPledge, launchCampaign } = useStore();
  const [movements, setMovements] = useState({});
  const prevRanksRef = useRef({});
  const swapDemoRef = useRef(false);
  const launchDemoRef = useRef(false);
  const addPledgeRef = useRef(addPledge);
  const launchCampaignRef = useRef(launchCampaign);
  const SCROLL_HIDE_DELAY = 500;
  const tableRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const hideTimerRef = useRef(null);

  const syncScrollable = useCallback(() => {
    const node = tableRef.current;
    if (!node) return;
    const scrollable = node.scrollHeight - node.clientHeight > 1;
    setIsScrollable(scrollable);
    if (!scrollable && isScrolling) {
      setIsScrolling(false);
      clearTimeout(hideTimerRef.current);
    }

  }, [isScrolling]);

  useEffect(() => {
    syncScrollable();
    const node = tableRef.current;
    if (!node) return;

    const observer = new ResizeObserver(syncScrollable);
    observer.observe(node);
    window.addEventListener("resize", syncScrollable);

    const handleScroll = () => {
      if (!isScrollable) return;
      setIsScrolling(true);
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setIsScrolling(false), SCROLL_HIDE_DELAY);
    };

    node.addEventListener("scroll", handleScroll);

    return () => {
      node.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", syncScrollable);
      observer.disconnect();
      clearTimeout(hideTimerRef.current);
    };
  }, [isScrollable, syncScrollable]);

  const tokens = useMemo(
    () => getTokens().filter(token => !token.isSystemToken && token.status !== "launched"),
    [getTokens]
  );
  
  const top10Tokens = useMemo(() => selectTopTokens(tokens), [tokens]);
  const navigate = useNavigate();
  
  useMovementTracking(top10Tokens, movements, setMovements, prevRanksRef);
  useSwapDemo(tokens, addPledge, swapDemoRef);

  const leader = top10Tokens[0];
  useTopLaunchDemo(leader, addPledgeRef, launchCampaignRef, launchDemoRef, setMovements);
  const renderLeaderboard = () => {
    return top10Tokens.map((token, index) => {
      const rankClass = index < 5 ? "leaderboard-rank--gold" : "leaderboard-rank";
      return (
        <div
        key={token.id}
        className={buildRowClass(movements, token.id)}
        onClick={() => navigate(`/token/${token.id}`)}
      >
        <div className={rankClass}>#{index + 1}</div>
        <div className="leaderboard-image">
          <img src={token.image} alt={token.name} />
        </div>
        <div className="leaderboard-ticker">{token.ticker}</div>
        <div className="leaderboard-pledged">
          {formatNumber(token.totalPledged)} stFUEL
        </div>
      </div>
      )
    });
  }

  return (
    <div className="leaderboard-page">
      <h1 className="leaderboard-title">Leaderboard</h1>
      <div ref={tableRef} className={`leaderboard-table ${isScrolling ? "leaderboard-table--scrolling" : ""}`}>
        {renderLeaderboard()}
      </div>
    </div>
  )
}