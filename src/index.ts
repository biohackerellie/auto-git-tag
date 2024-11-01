
import * as core from '@actions/core';
import * as github from '@actions/github';
import simpleGit from 'simple-git';
import semver from 'semver'

async function run() {
  try {
    const githubToken = core.getInput('github_token');
    const releaseBranch = core.getInput('release_branch') || 'release';
    const git = simpleGit();
    const branch =  await git.revparse(['--abbrev-ref', 'HEAD']).then(res => res.trim());
    const dryRun = core.getBooleanInput('dry_run') || false;
    if (branch.startsWith('refs/pull/')) {
      core.info('This is a pull request context. Skipping tagging.');
      return;
    }

    // Configure git
    await git.addConfig('user.name', 'github-actions[bot]');
    await git.addConfig('user.email', 'github-actions[bot]@users.noreply.github.com');

    // Determine Version Bump
    let bumpType: 'major' | 'minor' | 'patch' = 'patch';

    if (branch !== 'pull_request') {
      const commitMessages = (await git.log([`origin/${branch}..HEAD`])).all.map(commit => commit.message);
      for (const message of commitMessages) {
        if (message.includes('(major)')) {
          bumpType = 'major';
          break;
        } else if (message.includes('(minor)')) {
          bumpType = 'minor';
          break;
        } else if (message.includes('(patch)')) {
           bumpType = 'patch';
        }
      }
    }

    core.setOutput('bump_type', bumpType);

    // Get Latest Release Tag
    const tags = (await git.tags()).all.filter(tag => /^v\d+\.\d+\.\d+$/.test(tag));
    const sortedTags = tags.sort((a, b) => semver.compare(semver.clean(a)!, semver.clean(b)!));
    const latestReleaseTag = sortedTags[sortedTags.length - 1] || 'v0.0.0';
    core.setOutput('latest_release_tag', latestReleaseTag);

    // Get Latest Tag for Branch
    let currentTag = latestReleaseTag;
    if (branch !== releaseBranch) {
      const branchTags = (await git.tags()).all.filter(tag => tag.includes(`-${branch}.`));
      currentTag = branchTags.sort().reverse()[0] || `${latestReleaseTag}-${branch}.0`;
    }

    core.setOutput('latest_tag', currentTag);

    // Calculate Next Tag
    let nextTag: string;
    if (branch === releaseBranch) {
      const [major, minor, patch] = latestReleaseTag.replace(/^v/, '').split('.').map(Number);
      if (bumpType === 'major') {
        nextTag = `v${major + 1}.0.0`;
      } else if (bumpType === 'minor') {
        nextTag = `v${major}.${minor + 1}.0`;
      } else {
        nextTag = `v${major}.${minor}.${patch + 1}`;
      }
    } else {
      const baseVersion = latestReleaseTag.replace(/^v/, '');
      const branchSuffix = parseInt(currentTag.split('.').pop() || '0') + 1;
      nextTag = `v${baseVersion}-${branch}.${branchSuffix}`;
    }

    core.setOutput('NEXT_TAG', nextTag);

    if (dryRun) {
      core.info('Dry run enabled. Skipping tag push.');
      return
    }
    await git.addTag(nextTag);
    await git.pushTags(`https://${githubToken}@github.com/${github.context.repo.owner}/${github.context.repo.repo}`);
    core.info(`Successfully pushed tag ${nextTag}`);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
