export interface ApprovalResolver {
  isApproved(key: string): Promise<boolean>;
}

export class NoopApprovalResolver implements ApprovalResolver {
  async isApproved(): Promise<boolean> {
    return false;
  }
}
