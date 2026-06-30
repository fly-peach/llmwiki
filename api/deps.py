from fastapi import Request


async def get_user_id(request: Request) -> str:
    """Authenticate and return user_id.

    Local mode only: the auth_provider is a LocalAuthProvider that always
    returns the fixed single-user id.
    """
    auth_provider = request.app.state.auth_provider
    return await auth_provider.get_current_user(request)


async def get_user_service(request: Request):
    user_id = await get_user_id(request)
    return request.app.state.factory.user_service(user_id)


async def get_kb_service(request: Request):
    user_id = await get_user_id(request)
    return request.app.state.factory.kb_service(user_id)


async def get_document_service(request: Request):
    user_id = await get_user_id(request)
    return request.app.state.factory.document_service(user_id)
