export interface ApprovalResolver {
    isApproved(key: string): Promise<boolean>;
}
export declare class NoopApprovalResolver implements ApprovalResolver {
    isApproved(): Promise<boolean>;
}
