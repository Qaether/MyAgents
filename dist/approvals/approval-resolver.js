"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopApprovalResolver = void 0;
class NoopApprovalResolver {
    async isApproved() {
        return false;
    }
}
exports.NoopApprovalResolver = NoopApprovalResolver;
