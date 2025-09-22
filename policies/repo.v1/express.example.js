const express = require("express");
const { requirePolicy } = require("@aport/middleware");

const app = express();
app.use(express.json());

// Apply repo policy to PR creation routes
app.post("/repo/pr", requirePolicy("repo.v1"), async (req, res) => {
  try {
    const { repo, base_branch, head_branch, title, body, files_changed } =
      req.body;
    const passport = req.policyResult.passport;

    // Check repository allowlist
    const allowedRepos =
      passport.capabilities.find((cap) => cap.id === "repo.pr.create")?.params
        ?.allowed_repos || [];

    if (allowedRepos.length > 0 && !allowedRepos.includes(repo)) {
      return res.status(403).json({
        error: "Repository not allowed",
        allowed_repos: allowedRepos,
        upgrade_instructions: "Add repository to your passport's allowed_repos",
      });
    }

    // Check base branch allowlist
    const allowedBranches =
      passport.capabilities.find((cap) => cap.id === "repo.pr.create")?.params
        ?.allowed_base_branches || [];

    if (allowedBranches.length > 0 && !allowedBranches.includes(base_branch)) {
      return res.status(403).json({
        error: "Base branch not allowed",
        allowed_branches: allowedBranches,
      });
    }

    // Check file limits
    const maxFiles =
      passport.capabilities.find((cap) => cap.id === "repo.pr.create")?.params
        ?.max_files_changed || Infinity;

    if (files_changed && files_changed.length > maxFiles) {
      return res.status(403).json({
        error: "Too many files changed",
        max_files: maxFiles,
        requested: files_changed.length,
      });
    }

    // Check total lines added
    const totalLinesAdded =
      files_changed?.reduce((sum, file) => sum + (file.lines_added || 0), 0) ||
      0;
    const maxLines =
      passport.capabilities.find((cap) => cap.id === "repo.pr.create")?.params
        ?.max_total_added_lines || Infinity;

    if (totalLinesAdded > maxLines) {
      return res.status(403).json({
        error: "Too many lines added",
        max_lines: maxLines,
        requested: totalLinesAdded,
      });
    }

    // Check path allowlist
    const pathAllowlist =
      passport.capabilities.find((cap) => cap.id === "repo.pr.create")?.params
        ?.path_allowlist || [];

    if (pathAllowlist.length > 0 && files_changed) {
      const disallowedFiles = files_changed.filter(
        (file) =>
          !pathAllowlist.some((pattern) => file.path.match(new RegExp(pattern)))
      );

      if (disallowedFiles.length > 0) {
        return res.status(403).json({
          error: "Files outside allowed paths",
          disallowed_files: disallowedFiles.map((f) => f.path),
          path_allowlist: pathAllowlist,
        });
      }
    }

    // Check daily PR limit
    const dailyUsage = await getDailyPRUsage(passport.agent_id);
    if (dailyUsage >= passport.limits.max_prs_per_day) {
      return res.status(403).json({
        error: "Daily PR limit exceeded",
        limit: passport.limits.max_prs_per_day,
        current_usage: dailyUsage,
      });
    }

    // Create PR using your Git service
    const pr_id = await createPullRequest({
      repo,
      base_branch,
      head_branch,
      title,
      body,
      files_changed,
      agent_id: passport.agent_id,
      agent_name: passport.name,
    });

    // Record usage
    await recordPRUsage(passport.agent_id);

    // Log the PR creation
    console.log(
      `PR created: ${pr_id} in ${repo} by agent ${passport.agent_id}`
    );

    res.json({
      success: true,
      pr_id,
      repo,
      base_branch,
      head_branch,
      files_changed: files_changed?.length || 0,
      lines_added: totalLinesAdded,
      status: "created",
    });
  } catch (error) {
    console.error("PR creation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Apply repo policy to merge routes
app.post("/repo/merge", requirePolicy("repo.v1"), async (req, res) => {
  try {
    const { repo, pr_id, merge_method, delete_branch } = req.body;
    const passport = req.policyResult.passport;

    // Get PR details first
    const prDetails = await getPRDetails(repo, pr_id);

    // Check repository allowlist
    const allowedRepos =
      passport.capabilities.find((cap) => cap.id === "repo.merge")?.params
        ?.allowed_repos || [];

    if (allowedRepos.length > 0 && !allowedRepos.includes(repo)) {
      return res.status(403).json({
        error: "Repository not allowed for merging",
        allowed_repos: allowedRepos,
      });
    }

    // Check base branch allowlist
    const allowedBranches =
      passport.capabilities.find((cap) => cap.id === "repo.merge")?.params
        ?.allowed_base_branches || [];

    if (
      allowedBranches.length > 0 &&
      !allowedBranches.includes(prDetails.base_branch)
    ) {
      return res.status(403).json({
        error: "Base branch not allowed for merging",
        allowed_branches: allowedBranches,
      });
    }

    // Check required labels
    const requiredLabels =
      passport.capabilities.find((cap) => cap.id === "repo.merge")?.params
        ?.required_labels || [];

    if (requiredLabels.length > 0) {
      const missingLabels = requiredLabels.filter(
        (label) => !prDetails.labels.includes(label)
      );
      if (missingLabels.length > 0) {
        return res.status(403).json({
          error: "Required labels missing",
          missing_labels: missingLabels,
          current_labels: prDetails.labels,
        });
      }
    }

    // Check required reviews
    const requiredReviews =
      passport.capabilities.find((cap) => cap.id === "repo.merge")?.params
        ?.required_reviews || 0;

    if (prDetails.approvals < requiredReviews) {
      return res.status(403).json({
        error: "Insufficient reviews",
        required: requiredReviews,
        current: prDetails.approvals,
      });
    }

    // Check PR size limit
    const prSizeKB = prDetails.size_kb;
    if (prSizeKB > passport.limits.max_pr_size_kb) {
      return res.status(403).json({
        error: "PR size exceeds limit",
        size_kb: prSizeKB,
        limit_kb: passport.limits.max_pr_size_kb,
      });
    }

    // Check daily merge limit
    const dailyUsage = await getDailyMergeUsage(passport.agent_id);
    if (dailyUsage >= passport.limits.max_merges_per_day) {
      return res.status(403).json({
        error: "Daily merge limit exceeded",
        limit: passport.limits.max_merges_per_day,
        current_usage: dailyUsage,
      });
    }

    // Merge PR using your Git service
    const merge_result = await mergePullRequest({
      repo,
      pr_id,
      merge_method,
      delete_branch,
      agent_id: passport.agent_id,
      agent_name: passport.name,
    });

    // Record usage
    await recordMergeUsage(passport.agent_id);

    // Log the merge
    console.log(`PR merged: ${pr_id} in ${repo} by agent ${passport.agent_id}`);

    res.json({
      success: true,
      pr_id,
      repo,
      merge_sha: merge_result.sha,
      merge_method,
      status: "merged",
    });
  } catch (error) {
    console.error("PR merge error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mock functions (implement with your actual Git service)
async function createPullRequest({
  repo,
  base_branch,
  head_branch,
  title,
  body,
  files_changed,
  agent_id,
  agent_name,
}) {
  // Simulate PR creation
  await new Promise((resolve) => setTimeout(resolve, 200));
  return `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function getPRDetails(repo, pr_id) {
  // Mock PR details
  return {
    base_branch: "main",
    labels: ["enhancement", "agent-created"],
    approvals: 2,
    size_kb: 45,
  };
}

async function mergePullRequest({
  repo,
  pr_id,
  merge_method,
  delete_branch,
  agent_id,
  agent_name,
}) {
  // Simulate PR merge
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    sha: `sha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
}

async function getDailyPRUsage(agent_id) {
  // Get current daily PR usage
  return 0; // Mock value
}

async function getDailyMergeUsage(agent_id) {
  // Get current daily merge usage
  return 0; // Mock value
}

async function recordPRUsage(agent_id) {
  console.log(`Recorded PR creation for agent ${agent_id}`);
}

async function recordMergeUsage(agent_id) {
  console.log(`Recorded PR merge for agent ${agent_id}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Repository service running on port ${PORT}`);
  console.log("Protected by APort repo.v1 policy pack");
});
