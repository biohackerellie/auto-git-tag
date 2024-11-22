import * as core from "@actions/core";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import simpleGit from "simple-git";
import { run } from ".";
jest.mock("simple-git");
jest.mock("@actions/core");

type Tags = {
  all: string[];
};

interface Log {
  all: { message: string }[];
}

const mockGit = simpleGit as jest.MockedFunction<typeof simpleGit>;
const mockSetOutput = core.setOutput as jest.MockedFunction<
  typeof core.setOutput
>;
const mockAddConfig = jest.fn();
const mockLog = jest.fn<() => Promise<Log>>();
const mockTags = jest.fn<() => Promise<Tags>>();
const mockRevparse = jest.fn<() => Promise<number | string>>();
const mockAddTag = jest.fn();
const mockPushTags = jest.fn();

mockGit.mockReturnValue({
  addConfig: mockAddConfig,
  log: mockLog,
  tags: mockTags,
  revparse: mockRevparse,
  addTag: mockAddTag,
  pushTags: mockPushTags,
} as unknown as ReturnType<typeof simpleGit>);

describe("Auto Tag Action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Detects major version bump in release branch", async () => {
    // Simulate Git setup
    mockRevparse.mockResolvedValue("release");
    mockTags.mockResolvedValue({
      all: ["v1.0.0", "v1.1.0", "v1.2.0"],
    });
    mockLog.mockResolvedValue({
      all: [{ message: "feat(major): Add breaking feature" }],
    });

    await run();
    expect(mockSetOutput).toHaveBeenCalledWith("bump_type", "major");
    expect(mockSetOutput).toHaveBeenCalledWith("NEXT_TAG", "v2.0.0");
  });

  test("Detects minor version bump in release branch", async () => {
    // Simulate Git setup
    mockRevparse.mockResolvedValue("release");
    mockTags.mockResolvedValue({
      all: ["v1.0.0", "v1.1.0", "v1.2.0"],
    });
    mockLog.mockResolvedValue({
      all: [{ message: "feat(minor): Add new feature" }],
    });

    await run();
    expect(mockSetOutput).toHaveBeenCalledWith("bump_type", "minor");
    expect(mockSetOutput).toHaveBeenCalledWith("NEXT_TAG", "v1.3.0");
  });

  test("Detects patch version bump in release branch", async () => {
    // Simulate Git setup
    mockRevparse.mockResolvedValue("release");
    mockTags.mockResolvedValue({
      all: ["v1.0.0", "v1.1.0", "v1.2.0"],
    });
    mockLog.mockResolvedValue({
      all: [{ message: "fix(patch): Bug fix" }],
    });

    await run();
    expect(mockSetOutput).toHaveBeenCalledWith("bump_type", "patch");
    expect(mockSetOutput).toHaveBeenCalledWith("NEXT_TAG", "v1.2.1");
  });

  test("Calculates correct branch-specific tags", async () => {
    // Simulate Git setup
    mockRevparse.mockResolvedValue("canary");
    mockTags.mockResolvedValue({
      all: ["v1.2.0", "v1.2.0-canary.1", "v1.2.0-canary.2"],
    });
    mockLog.mockResolvedValue({
      all: [{ message: "feat: Canary commit" }],
    });

    await run();
    expect(mockSetOutput).toHaveBeenCalledWith("NEXT_TAG", "v1.2.0-canary.3");
  });

  test("Handles no prior tags (initial release)", async () => {
    // Simulate Git setup
    mockRevparse.mockResolvedValue("release");
    mockTags.mockResolvedValue({
      all: [],
    });
    mockLog.mockResolvedValue({
      all: [{ message: "feat(major): Initial commit" }],
    });

    await run();
    expect(mockSetOutput).toHaveBeenCalledWith("NEXT_TAG", "v1.0.0");
  });

  test("Handles more than one commit in a release merge, finds bump in commit message", async () => {
    mockRevparse.mockResolvedValue("release");
    mockTags.mockResolvedValue({
      all: ["v1.0.1", "v1.0.2", "v1.2.0", "v1.2.1", "v1.2.2"],
    });
    mockLog.mockResolvedValue({
      all: [
        { message: "feat: Add new feature" },
        { message: "feat(minor): Add another feature" },
        { message: "feat: Add yet another feature" },
      ],
    });
    await run();
    expect(mockSetOutput).toHaveBeenCalledWith("bump_type", "minor");
    expect(mockSetOutput).toHaveBeenCalledWith("NEXT_TAG", "v1.3.0");
  });
});
