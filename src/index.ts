import * as core from "@actions/core";
import * as github from "@actions/github";
import semver from "semver";
import simpleGit from "simple-git";

export async function run() {
  try {
    const githubToken = core.getInput("github_token");
    const releaseBranch = core.getInput("release_branch") || "release";
    const git = simpleGit();
    const branch = await git
      .revparse(["--abbrev-ref", "HEAD"])
      .then((res) => res.trim());
    console.log("Branch:", branch);
    const dryRun = core.getBooleanInput("dry_run") || false;
    if (branch.startsWith("refs/pull/")) {
      core.info("This is a pull request context. Skipping tagging.");
      return;
    }

    // Configure git
    await git.addConfig("user.name", "github-actions[bot]");
    await git.addConfig(
      "user.email",
      "github-actions[bot]@users.noreply.github.com",
    );

    // Determine Version Bump
    let bumpType: "major" | "minor" | "patch" = "patch";

    if (branch === releaseBranch) {
      const latestReleaseTag =
        (await git.tags()).all
          .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
          .sort((a, b) => semver.compare(semver.clean(a)!, semver.clean(b)!))
          .pop() || "v0.0.0";

      const commitMessages = (
        await git.log([`${latestReleaseTag}..HEAD`])
      ).all.map((commit) => commit.message);

      for (const message of commitMessages) {
        if (message.includes("(major)")) {
          bumpType = "major";
          break;
        }
        if (message.includes("(minor)")) {
          bumpType = "minor";
          break;
        }
        if (message.includes("(patch)")) {
          bumpType = "patch";
        }
      }
    } else {
      const commitMessages = (
        await git.log([`origin/${branch}..HEAD`])
      ).all.map((commit) => commit.message);
      for (const message of commitMessages) {
        if (message.includes("(major)")) {
          bumpType = "major";
          break;
        }
        if (message.includes("(minor)")) {
          bumpType = "minor";
          break;
        }
        if (message.includes("(patch)")) {
          bumpType = "patch";
        }
      }
    }

    core.setOutput("bump_type", bumpType);

    // Get Latest Release Tag
    const tags = (await git.tags()).all.filter((tag) =>
      /^v\d+\.\d+\.\d+$/.test(tag),
    );
    const sortedTags = tags.sort((a, b) =>
      semver.compare(semver.clean(a)!, semver.clean(b)!),
    );
    const latestReleaseTag = sortedTags[sortedTags.length - 1] || "v0.0.0";
    core.setOutput("latest_release_tag", latestReleaseTag);

    // Get Latest Tag for Branch
    let currentTag = latestReleaseTag;
    if (branch !== releaseBranch) {
      const branchTags = (await git.tags()).all
        .filter((tag) =>
          tag.startsWith(`v${semver.clean(latestReleaseTag)}-${branch}.`),
        )
        .map((tag) => {
          const match = tag.match(new RegExp(`-${branch}\.(\\d+)$`));
          return match ? Number.parseInt(match[1], 10) : 0;
        })
        .sort((a, b) => a - b);

      const lastSuffix = branchTags[branchTags.length - 1] || 0;
      currentTag = `${latestReleaseTag}-${branch}.${lastSuffix}`;
    }

    core.info(`Current tag for branch ${branch} is ${currentTag}`);
    core.setOutput("latest_tag", currentTag);

    // Calculate Next Tag
    let nextTag: string;
    if (branch === releaseBranch) {
      const cleanTag = semver.clean(latestReleaseTag) || "0.0.0";
      if (bumpType === "major") {
        nextTag = `v${semver.inc(cleanTag, "major")}`;
      } else if (bumpType === "minor") {
        nextTag = `v${semver.inc(cleanTag, "minor")}`;
      } else {
        nextTag = `v${semver.inc(cleanTag, "patch")}`;
      }
    } else {
      const baseVersion = semver.clean(latestReleaseTag) || "0.0.0";
      const branchSuffix =
        Number.parseInt(currentTag.split(".").pop() || "0", 10) + 1;
      nextTag = `v${baseVersion}-${branch}.${branchSuffix}`;
    }
    core.info(`Next tag for branch ${branch} is ${nextTag}`);
    core.setOutput("NEXT_TAG", nextTag);

    if (dryRun) {
      core.info("Dry run enabled. Skipping tag push.");
      return;
    }
    await git.addTag(nextTag);
    await git.pushTags(
      `https://${githubToken}@github.com/${github.context.repo.owner}/${github.context.repo.repo}`,
    );
    core.info(`Successfully pushed tag ${nextTag}`);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
