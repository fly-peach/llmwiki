from typing import Optional, List, Set

# 工具元数据 - 定义所有工具及其权限分类
TOOL_METADATA = {
    'guide': {'category': 'readonly', 'required': True},
    'list_knowledge_bases': {'category': 'readonly', 'required': True},
    'search': {'category': 'readonly', 'required': False},
    'read': {'category': 'readonly', 'required': False},
    'create': {'category': 'write', 'required': False},
    'edit': {'category': 'write', 'required': False},
    'append': {'category': 'write', 'required': False},
    'delete': {'category': 'delete', 'required': False},
    'lint': {'category': 'write', 'required': False},
    'create_knowledge_base': {'category': 'manage', 'required': False},
}

# 权限预设定义
PRESETS = {
    'read-only': {'guide', 'list_knowledge_bases', 'search', 'read'},
    'no-delete': {'guide', 'list_knowledge_bases', 'search', 'read', 'create', 'edit', 'append', 'lint', 'create_knowledge_base'},
    'wiki-only': {'guide', 'list_knowledge_bases', 'search', 'read', 'create', 'edit', 'append', 'lint', 'create_knowledge_base'},
    'full': {'guide', 'list_knowledge_bases', 'search', 'read', 'create', 'edit', 'append', 'delete', 'lint', 'create_knowledge_base'},
}


def resolve_allowed_tools(allow: Optional[str] = None, preset: Optional[str] = None) -> Set[str]:
    """
    解析允许的工具列表

    Args:
        allow: 逗号分隔的工具名列表
        preset: 预设名称 (read-only, no-delete, wiki-only, full)

    Returns:
        允许的工具名称集合
    """
    if preset and preset in PRESETS:
        return PRESETS[preset].copy()

    if allow:
        tools = {t.strip() for t in allow.split(',')}
        # 确保基础工具总是可用
        tools.add('guide')
        tools.add('list_knowledge_bases')
        return tools

    # 默认完全访问
    return PRESETS['full'].copy()


def register(mcp, get_user_id, fs_factory, allowed_tools: Optional[Set[str]] = None) -> None:
    """
    注册 MCP 工具

    Args:
        mcp: FastMCP 实例
        get_user_id: 获取用户ID的函数
        fs_factory: 文件系统工厂函数
        allowed_tools: 允许的工具名称集合（None 表示全部允许）
    """
    from .guide import register as register_guide
    from .list import register as register_list
    from .search import register as register_search
    from .read import register as register_read
    from .write import register as register_write
    from .delete import register as register_delete
    from .lint import register as register_lint

    # 如果没有指定允许的工具，默认全部允许
    allowed = allowed_tools or PRESETS['full']

    # 只注册允许的工具
    register_guide(mcp, get_user_id, fs_factory)
    register_list(mcp, get_user_id, fs_factory)

    if 'search' in allowed:
        register_search(mcp, get_user_id, fs_factory)

    if 'read' in allowed:
        register_read(mcp, get_user_id, fs_factory)

    if {'create', 'edit', 'append'} & allowed:
        register_write(mcp, get_user_id, fs_factory)

    if 'delete' in allowed:
        register_delete(mcp, get_user_id, fs_factory)

    if 'lint' in allowed:
        register_lint(mcp, get_user_id, fs_factory)
