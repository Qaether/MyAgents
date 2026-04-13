import { z } from 'zod';
export declare const ProjectConfigSchema: z.ZodObject<{
    project: z.ZodObject<{
        name: z.ZodString;
        defaultWorkflow: z.ZodString;
        agentsDir: z.ZodString;
        workflowsDir: z.ZodString;
        runsDir: z.ZodDefault<z.ZodString>;
        artifactsDir: z.ZodDefault<z.ZodString>;
        eventsDir: z.ZodDefault<z.ZodString>;
        approvalsFile: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        defaultWorkflow?: string;
        agentsDir?: string;
        workflowsDir?: string;
        runsDir?: string;
        artifactsDir?: string;
        eventsDir?: string;
        approvalsFile?: string;
    }, {
        name?: string;
        defaultWorkflow?: string;
        agentsDir?: string;
        workflowsDir?: string;
        runsDir?: string;
        artifactsDir?: string;
        eventsDir?: string;
        approvalsFile?: string;
    }>;
    provider: z.ZodObject<{
        kind: z.ZodLiteral<"openai">;
        model: z.ZodString;
        apiKeyEnv: z.ZodDefault<z.ZodString>;
        apiKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind?: "openai";
        model?: string;
        apiKeyEnv?: string;
        apiKey?: string;
    }, {
        kind?: "openai";
        model?: string;
        apiKeyEnv?: string;
        apiKey?: string;
    }>;
}, "strip", z.ZodTypeAny, {
    project?: {
        name?: string;
        defaultWorkflow?: string;
        agentsDir?: string;
        workflowsDir?: string;
        runsDir?: string;
        artifactsDir?: string;
        eventsDir?: string;
        approvalsFile?: string;
    };
    provider?: {
        kind?: "openai";
        model?: string;
        apiKeyEnv?: string;
        apiKey?: string;
    };
}, {
    project?: {
        name?: string;
        defaultWorkflow?: string;
        agentsDir?: string;
        workflowsDir?: string;
        runsDir?: string;
        artifactsDir?: string;
        eventsDir?: string;
        approvalsFile?: string;
    };
    provider?: {
        kind?: "openai";
        model?: string;
        apiKeyEnv?: string;
        apiKey?: string;
    };
}>;
export declare const AgentSpecSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    role: z.ZodString;
    systemPrompt: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
    temperature: z.ZodOptional<z.ZodNumber>;
    allowedTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    model?: string;
    id?: string;
    role?: string;
    systemPrompt?: string;
    temperature?: number;
    allowedTools?: string[];
}, {
    name?: string;
    model?: string;
    id?: string;
    role?: string;
    systemPrompt?: string;
    temperature?: number;
    allowedTools?: string[];
}>;
export declare const StepConditionSchema: z.ZodObject<{
    stepId: z.ZodString;
    exists: z.ZodOptional<z.ZodBoolean>;
    equals: z.ZodOptional<z.ZodString>;
    includes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    includes?: string;
    stepId?: string;
    exists?: boolean;
    equals?: string;
}, {
    includes?: string;
    stepId?: string;
    exists?: boolean;
    equals?: string;
}>;
export declare const StructuredFieldTypeSchema: z.ZodEnum<["string", "string[]", "number", "boolean"]>;
export declare const StructuredOutputSchema: z.ZodObject<{
    fields: z.ZodRecord<z.ZodString, z.ZodEnum<["string", "string[]", "number", "boolean"]>>;
}, "strip", z.ZodTypeAny, {
    fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
}, {
    fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
}>;
export declare const ToolCallSchema: z.ZodObject<{
    tool: z.ZodString;
    as: z.ZodString;
    input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    tool?: string;
    as?: string;
    input?: Record<string, string>;
}, {
    tool?: string;
    as?: string;
    input?: Record<string, string>;
}>;
export declare const ToolSelectionSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    maxCalls: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled?: boolean;
    maxCalls?: number;
}, {
    enabled?: boolean;
    maxCalls?: number;
}>;
export declare const ExecutionPolicySchema: z.ZodObject<{
    retryCount: z.ZodOptional<z.ZodNumber>;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
    continueOnError: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    retryCount?: number;
    timeoutMs?: number;
    continueOnError?: boolean;
}, {
    retryCount?: number;
    timeoutMs?: number;
    continueOnError?: boolean;
}>;
export declare const ApprovalGateSchema: z.ZodObject<{
    required: z.ZodBoolean;
    key: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message?: string;
    required?: boolean;
    key?: string;
}, {
    message?: string;
    required?: boolean;
    key?: string;
}>;
export declare const ArtifactSchema: z.ZodObject<{
    name: z.ZodString;
    fileName: z.ZodString;
    contentFrom: z.ZodOptional<z.ZodEnum<["output"]>>;
    template: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    fileName?: string;
    contentFrom?: "output";
    template?: string;
}, {
    name?: string;
    fileName?: string;
    contentFrom?: "output";
    template?: string;
}>;
export declare const WorkflowStepSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    instruction: z.ZodString;
    dependsOn: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    when: z.ZodOptional<z.ZodObject<{
        stepId: z.ZodString;
        exists: z.ZodOptional<z.ZodBoolean>;
        equals: z.ZodOptional<z.ZodString>;
        includes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        includes?: string;
        stepId?: string;
        exists?: boolean;
        equals?: string;
    }, {
        includes?: string;
        stepId?: string;
        exists?: boolean;
        equals?: string;
    }>>;
    structuredOutput: z.ZodOptional<z.ZodObject<{
        fields: z.ZodRecord<z.ZodString, z.ZodEnum<["string", "string[]", "number", "boolean"]>>;
    }, "strip", z.ZodTypeAny, {
        fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
    }, {
        fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
    }>>;
    tools: z.ZodOptional<z.ZodArray<z.ZodObject<{
        tool: z.ZodString;
        as: z.ZodString;
        input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        tool?: string;
        as?: string;
        input?: Record<string, string>;
    }, {
        tool?: string;
        as?: string;
        input?: Record<string, string>;
    }>, "many">>;
    toolSelection: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        maxCalls: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled?: boolean;
        maxCalls?: number;
    }, {
        enabled?: boolean;
        maxCalls?: number;
    }>>;
    execution: z.ZodOptional<z.ZodObject<{
        retryCount: z.ZodOptional<z.ZodNumber>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
        continueOnError: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        retryCount?: number;
        timeoutMs?: number;
        continueOnError?: boolean;
    }, {
        retryCount?: number;
        timeoutMs?: number;
        continueOnError?: boolean;
    }>>;
    approval: z.ZodOptional<z.ZodObject<{
        required: z.ZodBoolean;
        key: z.ZodOptional<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message?: string;
        required?: boolean;
        key?: string;
    }, {
        message?: string;
        required?: boolean;
        key?: string;
    }>>;
    artifacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        fileName: z.ZodString;
        contentFrom: z.ZodOptional<z.ZodEnum<["output"]>>;
        template: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        fileName?: string;
        contentFrom?: "output";
        template?: string;
    }, {
        name?: string;
        fileName?: string;
        contentFrom?: "output";
        template?: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    id?: string;
    agentId?: string;
    instruction?: string;
    dependsOn?: string[];
    when?: {
        includes?: string;
        stepId?: string;
        exists?: boolean;
        equals?: string;
    };
    structuredOutput?: {
        fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
    };
    tools?: {
        tool?: string;
        as?: string;
        input?: Record<string, string>;
    }[];
    toolSelection?: {
        enabled?: boolean;
        maxCalls?: number;
    };
    execution?: {
        retryCount?: number;
        timeoutMs?: number;
        continueOnError?: boolean;
    };
    approval?: {
        message?: string;
        required?: boolean;
        key?: string;
    };
    artifacts?: {
        name?: string;
        fileName?: string;
        contentFrom?: "output";
        template?: string;
    }[];
}, {
    id?: string;
    agentId?: string;
    instruction?: string;
    dependsOn?: string[];
    when?: {
        includes?: string;
        stepId?: string;
        exists?: boolean;
        equals?: string;
    };
    structuredOutput?: {
        fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
    };
    tools?: {
        tool?: string;
        as?: string;
        input?: Record<string, string>;
    }[];
    toolSelection?: {
        enabled?: boolean;
        maxCalls?: number;
    };
    execution?: {
        retryCount?: number;
        timeoutMs?: number;
        continueOnError?: boolean;
    };
    approval?: {
        message?: string;
        required?: boolean;
        key?: string;
    };
    artifacts?: {
        name?: string;
        fileName?: string;
        contentFrom?: "output";
        template?: string;
    }[];
}>;
export declare const WorkflowStageSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        agentId: z.ZodString;
        instruction: z.ZodString;
        dependsOn: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        when: z.ZodOptional<z.ZodObject<{
            stepId: z.ZodString;
            exists: z.ZodOptional<z.ZodBoolean>;
            equals: z.ZodOptional<z.ZodString>;
            includes: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            includes?: string;
            stepId?: string;
            exists?: boolean;
            equals?: string;
        }, {
            includes?: string;
            stepId?: string;
            exists?: boolean;
            equals?: string;
        }>>;
        structuredOutput: z.ZodOptional<z.ZodObject<{
            fields: z.ZodRecord<z.ZodString, z.ZodEnum<["string", "string[]", "number", "boolean"]>>;
        }, "strip", z.ZodTypeAny, {
            fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
        }, {
            fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
        }>>;
        tools: z.ZodOptional<z.ZodArray<z.ZodObject<{
            tool: z.ZodString;
            as: z.ZodString;
            input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            tool?: string;
            as?: string;
            input?: Record<string, string>;
        }, {
            tool?: string;
            as?: string;
            input?: Record<string, string>;
        }>, "many">>;
        toolSelection: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            maxCalls: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled?: boolean;
            maxCalls?: number;
        }, {
            enabled?: boolean;
            maxCalls?: number;
        }>>;
        execution: z.ZodOptional<z.ZodObject<{
            retryCount: z.ZodOptional<z.ZodNumber>;
            timeoutMs: z.ZodOptional<z.ZodNumber>;
            continueOnError: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            retryCount?: number;
            timeoutMs?: number;
            continueOnError?: boolean;
        }, {
            retryCount?: number;
            timeoutMs?: number;
            continueOnError?: boolean;
        }>>;
        approval: z.ZodOptional<z.ZodObject<{
            required: z.ZodBoolean;
            key: z.ZodOptional<z.ZodString>;
            message: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            message?: string;
            required?: boolean;
            key?: string;
        }, {
            message?: string;
            required?: boolean;
            key?: string;
        }>>;
        artifacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            fileName: z.ZodString;
            contentFrom: z.ZodOptional<z.ZodEnum<["output"]>>;
            template: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name?: string;
            fileName?: string;
            contentFrom?: "output";
            template?: string;
        }, {
            name?: string;
            fileName?: string;
            contentFrom?: "output";
            template?: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id?: string;
        agentId?: string;
        instruction?: string;
        dependsOn?: string[];
        when?: {
            includes?: string;
            stepId?: string;
            exists?: boolean;
            equals?: string;
        };
        structuredOutput?: {
            fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
        };
        tools?: {
            tool?: string;
            as?: string;
            input?: Record<string, string>;
        }[];
        toolSelection?: {
            enabled?: boolean;
            maxCalls?: number;
        };
        execution?: {
            retryCount?: number;
            timeoutMs?: number;
            continueOnError?: boolean;
        };
        approval?: {
            message?: string;
            required?: boolean;
            key?: string;
        };
        artifacts?: {
            name?: string;
            fileName?: string;
            contentFrom?: "output";
            template?: string;
        }[];
    }, {
        id?: string;
        agentId?: string;
        instruction?: string;
        dependsOn?: string[];
        when?: {
            includes?: string;
            stepId?: string;
            exists?: boolean;
            equals?: string;
        };
        structuredOutput?: {
            fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
        };
        tools?: {
            tool?: string;
            as?: string;
            input?: Record<string, string>;
        }[];
        toolSelection?: {
            enabled?: boolean;
            maxCalls?: number;
        };
        execution?: {
            retryCount?: number;
            timeoutMs?: number;
            continueOnError?: boolean;
        };
        approval?: {
            message?: string;
            required?: boolean;
            key?: string;
        };
        artifacts?: {
            name?: string;
            fileName?: string;
            contentFrom?: "output";
            template?: string;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name?: string;
    id?: string;
    steps?: {
        id?: string;
        agentId?: string;
        instruction?: string;
        dependsOn?: string[];
        when?: {
            includes?: string;
            stepId?: string;
            exists?: boolean;
            equals?: string;
        };
        structuredOutput?: {
            fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
        };
        tools?: {
            tool?: string;
            as?: string;
            input?: Record<string, string>;
        }[];
        toolSelection?: {
            enabled?: boolean;
            maxCalls?: number;
        };
        execution?: {
            retryCount?: number;
            timeoutMs?: number;
            continueOnError?: boolean;
        };
        approval?: {
            message?: string;
            required?: boolean;
            key?: string;
        };
        artifacts?: {
            name?: string;
            fileName?: string;
            contentFrom?: "output";
            template?: string;
        }[];
    }[];
}, {
    name?: string;
    id?: string;
    steps?: {
        id?: string;
        agentId?: string;
        instruction?: string;
        dependsOn?: string[];
        when?: {
            includes?: string;
            stepId?: string;
            exists?: boolean;
            equals?: string;
        };
        structuredOutput?: {
            fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
        };
        tools?: {
            tool?: string;
            as?: string;
            input?: Record<string, string>;
        }[];
        toolSelection?: {
            enabled?: boolean;
            maxCalls?: number;
        };
        execution?: {
            retryCount?: number;
            timeoutMs?: number;
            continueOnError?: boolean;
        };
        approval?: {
            message?: string;
            required?: boolean;
            key?: string;
        };
        artifacts?: {
            name?: string;
            fileName?: string;
            contentFrom?: "output";
            template?: string;
        }[];
    }[];
}>;
export declare const WorkflowSpecSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    allowedTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    stages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        steps: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            agentId: z.ZodString;
            instruction: z.ZodString;
            dependsOn: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            when: z.ZodOptional<z.ZodObject<{
                stepId: z.ZodString;
                exists: z.ZodOptional<z.ZodBoolean>;
                equals: z.ZodOptional<z.ZodString>;
                includes: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                includes?: string;
                stepId?: string;
                exists?: boolean;
                equals?: string;
            }, {
                includes?: string;
                stepId?: string;
                exists?: boolean;
                equals?: string;
            }>>;
            structuredOutput: z.ZodOptional<z.ZodObject<{
                fields: z.ZodRecord<z.ZodString, z.ZodEnum<["string", "string[]", "number", "boolean"]>>;
            }, "strip", z.ZodTypeAny, {
                fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
            }, {
                fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
            }>>;
            tools: z.ZodOptional<z.ZodArray<z.ZodObject<{
                tool: z.ZodString;
                as: z.ZodString;
                input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            }, "strip", z.ZodTypeAny, {
                tool?: string;
                as?: string;
                input?: Record<string, string>;
            }, {
                tool?: string;
                as?: string;
                input?: Record<string, string>;
            }>, "many">>;
            toolSelection: z.ZodOptional<z.ZodObject<{
                enabled: z.ZodBoolean;
                maxCalls: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                enabled?: boolean;
                maxCalls?: number;
            }, {
                enabled?: boolean;
                maxCalls?: number;
            }>>;
            execution: z.ZodOptional<z.ZodObject<{
                retryCount: z.ZodOptional<z.ZodNumber>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
                continueOnError: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                retryCount?: number;
                timeoutMs?: number;
                continueOnError?: boolean;
            }, {
                retryCount?: number;
                timeoutMs?: number;
                continueOnError?: boolean;
            }>>;
            approval: z.ZodOptional<z.ZodObject<{
                required: z.ZodBoolean;
                key: z.ZodOptional<z.ZodString>;
                message: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                message?: string;
                required?: boolean;
                key?: string;
            }, {
                message?: string;
                required?: boolean;
                key?: string;
            }>>;
            artifacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                fileName: z.ZodString;
                contentFrom: z.ZodOptional<z.ZodEnum<["output"]>>;
                template: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                name?: string;
                fileName?: string;
                contentFrom?: "output";
                template?: string;
            }, {
                name?: string;
                fileName?: string;
                contentFrom?: "output";
                template?: string;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            id?: string;
            agentId?: string;
            instruction?: string;
            dependsOn?: string[];
            when?: {
                includes?: string;
                stepId?: string;
                exists?: boolean;
                equals?: string;
            };
            structuredOutput?: {
                fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
            };
            tools?: {
                tool?: string;
                as?: string;
                input?: Record<string, string>;
            }[];
            toolSelection?: {
                enabled?: boolean;
                maxCalls?: number;
            };
            execution?: {
                retryCount?: number;
                timeoutMs?: number;
                continueOnError?: boolean;
            };
            approval?: {
                message?: string;
                required?: boolean;
                key?: string;
            };
            artifacts?: {
                name?: string;
                fileName?: string;
                contentFrom?: "output";
                template?: string;
            }[];
        }, {
            id?: string;
            agentId?: string;
            instruction?: string;
            dependsOn?: string[];
            when?: {
                includes?: string;
                stepId?: string;
                exists?: boolean;
                equals?: string;
            };
            structuredOutput?: {
                fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
            };
            tools?: {
                tool?: string;
                as?: string;
                input?: Record<string, string>;
            }[];
            toolSelection?: {
                enabled?: boolean;
                maxCalls?: number;
            };
            execution?: {
                retryCount?: number;
                timeoutMs?: number;
                continueOnError?: boolean;
            };
            approval?: {
                message?: string;
                required?: boolean;
                key?: string;
            };
            artifacts?: {
                name?: string;
                fileName?: string;
                contentFrom?: "output";
                template?: string;
            }[];
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        id?: string;
        steps?: {
            id?: string;
            agentId?: string;
            instruction?: string;
            dependsOn?: string[];
            when?: {
                includes?: string;
                stepId?: string;
                exists?: boolean;
                equals?: string;
            };
            structuredOutput?: {
                fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
            };
            tools?: {
                tool?: string;
                as?: string;
                input?: Record<string, string>;
            }[];
            toolSelection?: {
                enabled?: boolean;
                maxCalls?: number;
            };
            execution?: {
                retryCount?: number;
                timeoutMs?: number;
                continueOnError?: boolean;
            };
            approval?: {
                message?: string;
                required?: boolean;
                key?: string;
            };
            artifacts?: {
                name?: string;
                fileName?: string;
                contentFrom?: "output";
                template?: string;
            }[];
        }[];
    }, {
        name?: string;
        id?: string;
        steps?: {
            id?: string;
            agentId?: string;
            instruction?: string;
            dependsOn?: string[];
            when?: {
                includes?: string;
                stepId?: string;
                exists?: boolean;
                equals?: string;
            };
            structuredOutput?: {
                fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
            };
            tools?: {
                tool?: string;
                as?: string;
                input?: Record<string, string>;
            }[];
            toolSelection?: {
                enabled?: boolean;
                maxCalls?: number;
            };
            execution?: {
                retryCount?: number;
                timeoutMs?: number;
                continueOnError?: boolean;
            };
            approval?: {
                message?: string;
                required?: boolean;
                key?: string;
            };
            artifacts?: {
                name?: string;
                fileName?: string;
                contentFrom?: "output";
                template?: string;
            }[];
        }[];
    }>, "many">;
    output: z.ZodObject<{
        finalStepId: z.ZodString;
        includeSteps: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        finalStepId?: string;
        includeSteps?: string[];
    }, {
        finalStepId?: string;
        includeSteps?: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    output?: {
        finalStepId?: string;
        includeSteps?: string[];
    };
    name?: string;
    id?: string;
    allowedTools?: string[];
    description?: string;
    stages?: {
        name?: string;
        id?: string;
        steps?: {
            id?: string;
            agentId?: string;
            instruction?: string;
            dependsOn?: string[];
            when?: {
                includes?: string;
                stepId?: string;
                exists?: boolean;
                equals?: string;
            };
            structuredOutput?: {
                fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
            };
            tools?: {
                tool?: string;
                as?: string;
                input?: Record<string, string>;
            }[];
            toolSelection?: {
                enabled?: boolean;
                maxCalls?: number;
            };
            execution?: {
                retryCount?: number;
                timeoutMs?: number;
                continueOnError?: boolean;
            };
            approval?: {
                message?: string;
                required?: boolean;
                key?: string;
            };
            artifacts?: {
                name?: string;
                fileName?: string;
                contentFrom?: "output";
                template?: string;
            }[];
        }[];
    }[];
}, {
    output?: {
        finalStepId?: string;
        includeSteps?: string[];
    };
    name?: string;
    id?: string;
    allowedTools?: string[];
    description?: string;
    stages?: {
        name?: string;
        id?: string;
        steps?: {
            id?: string;
            agentId?: string;
            instruction?: string;
            dependsOn?: string[];
            when?: {
                includes?: string;
                stepId?: string;
                exists?: boolean;
                equals?: string;
            };
            structuredOutput?: {
                fields?: Record<string, "string" | "number" | "boolean" | "string[]">;
            };
            tools?: {
                tool?: string;
                as?: string;
                input?: Record<string, string>;
            }[];
            toolSelection?: {
                enabled?: boolean;
                maxCalls?: number;
            };
            execution?: {
                retryCount?: number;
                timeoutMs?: number;
                continueOnError?: boolean;
            };
            approval?: {
                message?: string;
                required?: boolean;
                key?: string;
            };
            artifacts?: {
                name?: string;
                fileName?: string;
                contentFrom?: "output";
                template?: string;
            }[];
        }[];
    }[];
}>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type OpenAIProviderConfig = ProjectConfig['provider'];
export interface ResolvedOpenAIProviderConfig extends OpenAIProviderConfig {
    apiKey: string;
}
export type AgentFile = z.infer<typeof AgentSpecSchema>;
export type WorkflowFile = z.infer<typeof WorkflowSpecSchema>;
