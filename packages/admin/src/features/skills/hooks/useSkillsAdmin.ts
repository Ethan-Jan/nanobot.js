import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "antd";
import {
  deleteSkill,
  getSkillDetail,
  getSkills,
  importSkillFromGitHub,
  reloadSkills,
  searchGitHubSkills,
} from "@/shared/api";
import type { GitHubSkillInfo, SkillManifest } from "@/shared/types";

export function useSkillsAdmin() {
  const { message } = App.useApp();
  const messageRef = useRef(message);
  messageRef.current = message;

  const [skills, setSkills] = useState<SkillManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<SkillManifest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GitHubSkillInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [broadGitHubSearch, setBroadGitHubSearch] = useState(false);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await getSkills();
      setSkills(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const openImportModal = useCallback(() => setImportOpen(true), []);
  const closeImportModal = useCallback(() => {
    setImportOpen(false);
    setGithubUrl("");
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  const showDetail = useCallback(async (name: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await getSkillDetail(name);
      setDetailSkill(detail);
    } catch (e) {
      messageRef.current.error(e instanceof Error ? e.message : "获取详情失败");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailSkill(null);
  }, []);

  const importFromUrl = useCallback(
    async (urlOverride?: string) => {
      const u = (urlOverride ?? githubUrl).trim();
      if (!u) {
        messageRef.current.warning("请输入 GitHub 仓库地址");
        return;
      }
      setImporting(true);
      try {
        await importSkillFromGitHub(u);
        messageRef.current.success("技能导入成功");
        closeImportModal();
        void loadSkills();
      } catch (e) {
        messageRef.current.error(e instanceof Error ? e.message : "导入失败");
      } finally {
        setImporting(false);
      }
    },
    [githubUrl, closeImportModal, loadSkills],
  );

  const removeSkill = useCallback(
    async (name: string) => {
      try {
        await deleteSkill(name);
        messageRef.current.success(`已删除技能: ${name}`);
        void loadSkills();
      } catch (e) {
        messageRef.current.error(e instanceof Error ? e.message : "删除失败");
      }
    },
    [loadSkills],
  );

  const reload = useCallback(async () => {
    try {
      await reloadSkills();
      messageRef.current.success("技能已重新加载");
      void loadSkills();
    } catch (e) {
      messageRef.current.error(e instanceof Error ? e.message : "重载失败");
    }
  }, [loadSkills]);

  const search = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchGitHubSkills(searchQuery.trim(), broadGitHubSearch);
      setSearchResults(results);
      if (results.length === 0) {
        messageRef.current.info("无结果，可尝试开启「扩大搜索」或换关键词");
      }
    } catch (e) {
      messageRef.current.error(e instanceof Error ? e.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  }, [searchQuery, broadGitHubSearch]);

  return {
    skills,
    loading,
    err,
    loadSkills,
    detailOpen,
    detailSkill,
    detailLoading,
    showDetail,
    closeDetail,
    importOpen,
    githubUrl,
    setGithubUrl,
    importing,
    searchQuery,
    setSearchQuery,
    searchResults,
    searching,
    broadGitHubSearch,
    setBroadGitHubSearch,
    openImportModal,
    closeImportModal,
    importFromUrl,
    removeSkill,
    reload,
    search,
  };
}
