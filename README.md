# Auto Tag GitHub Action

An action for automatically tagging git commits based on the commit messages and branch names.


## Inputs

- `github_token`: **Required**. The GitHub token for authentication.
- `release_branch`: The branch considered as the release branch. Default: `release`.


## Usage

Create a `.github/workflows/auto-tag.yml` file or add the following to an existing workflow file.

```yaml


name: Custom Auto Tag

on:
  workflow_dispatch:
  push:
    branches: ["*"]

permissions:
  contents: write

jobs:
  tag:
    runs-on: ubuntu-latest
    steps: 
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: biohackerellie/auto-git-tag@v1
      id: tag # This is the id of the step, you can use this to access the output of the step 
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        release_branch: 'main' # Optional, default is 'release'
        dry_run: false # Optional, default is false
# a dry run will not push the tag to git, but will output the tag which you can use in a subsequent step
    - uses: ubuntu-latest
      run: echo "{{ steps.tag.outputs.NEXT_TAG }}"
          
```

The action will automatically tag the release based on the commit messages and branch name. If the branch name is the same as the `release_branch` input, the action will tag the release based on the commit messages.

Commits to non-release branch, in this case we are committing to canary: 
```bash
# Previous version: 1.0.0
git commit -m "fix: bug fix"

# New tag: v1.0.0-canary.1

```

Commits to release branch:
```bash
# Previous version: 1.0.0
git commit -m "fix: (minor) bug fix"

# New tag: v1.1.0
```

