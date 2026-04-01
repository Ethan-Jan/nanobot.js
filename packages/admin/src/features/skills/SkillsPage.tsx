import { Alert, Button, Typography } from "antd";
import { PageSpinner } from "@/shared/ui/PageSpinner";
import { InstalledSkillsCard } from "./components/InstalledSkillsCard";
import { SkillDetailModal } from "./components/SkillDetailModal";
import { SkillImportModal } from "./components/SkillImportModal";
import { SkillsIntroAlert } from "./components/SkillsIntroAlert";
import { useSkillsAdmin } from "./hooks/useSkillsAdmin";

export function SkillsPage() {
  const s = useSkillsAdmin();

  if (s.loading) {
    return <PageSpinner />;
  }

  if (s.err) {
    return (
      <Alert
        type="error"
        showIcon
        title="加载技能列表失败"
        description={s.err}
        action={<Button onClick={() => void s.loadSkills()}>重试</Button>}
      />
    );
  }

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        技能管理
      </Typography.Title>

      <SkillsIntroAlert />

      <InstalledSkillsCard
        skills={s.skills}
        onReload={() => void s.reload()}
        onOpenImport={s.openImportModal}
        onShowDetail={(name) => void s.showDetail(name)}
        onDelete={(name) => void s.removeSkill(name)}
      />

      <SkillDetailModal
        open={s.detailOpen}
        loading={s.detailLoading}
        skill={s.detailSkill}
        onClose={s.closeDetail}
      />

      <SkillImportModal
        open={s.importOpen}
        githubUrl={s.githubUrl}
        onGithubUrlChange={s.setGithubUrl}
        importing={s.importing}
        onImport={(url) => void s.importFromUrl(url)}
        searchQuery={s.searchQuery}
        onSearchQueryChange={s.setSearchQuery}
        broadGitHubSearch={s.broadGitHubSearch}
        onBroadChange={s.setBroadGitHubSearch}
        searching={s.searching}
        onSearch={() => void s.search()}
        searchResults={s.searchResults}
        onClose={s.closeImportModal}
      />
    </div>
  );
}
