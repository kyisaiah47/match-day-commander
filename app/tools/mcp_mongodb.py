"""
MongoDB MCP Client — routes MongoDB tool calls through the MongoDB MCP server.

Uses @mongodb-js/mongodb-mcp-server via subprocess transport (stdio).
Falls back to direct Motor driver calls if the MCP server is unavailable
(e.g. Node.js not present in the environment).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── MCP client (mcp Python SDK) ──────────────────────────────────────────────

_mcp_client: Optional[Any] = None
_mcp_session: Optional[Any] = None
_mcp_available: Optional[bool] = None  # None = not yet determined


async def _ensure_mcp_session():
    """
    Lazily initialise the MCP session to the MongoDB MCP server.

    The server is spawned as a subprocess using the stdio transport.  If the
    `mcp` Python package or the `npx` binary are not found the flag is set to
    False and all callers fall back to the direct Motor driver.
    """
    global _mcp_client, _mcp_session, _mcp_available

    if _mcp_available is False:
        return None
    if _mcp_session is not None:
        return _mcp_session

    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
    except ImportError:
        logger.warning("mcp package not installed — falling back to direct Motor driver")
        _mcp_available = False
        return None

    mongodb_uri = os.environ.get("MONGODB_URI", "")
    if not mongodb_uri:
        logger.warning("MONGODB_URI not set — falling back to direct Motor driver")
        _mcp_available = False
        return None

    # Check if npx is available
    try:
        proc = await asyncio.create_subprocess_exec(
            "npx", "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=5)
    except (FileNotFoundError, asyncio.TimeoutError):
        logger.warning("npx not found — falling back to direct Motor driver")
        _mcp_available = False
        return None

    try:
        server_params = StdioServerParameters(
            command="npx",
            args=[
                "-y",
                "@mongodb-js/mongodb-mcp-server",
                "--connectionString",
                mongodb_uri,
            ],
            env={**os.environ},
        )

        cm = stdio_client(server_params)
        read, write = await cm.__aenter__()
        session = ClientSession(read, write)
        await session.__aenter__()
        await session.initialize()

        _mcp_client = cm
        _mcp_session = session
        _mcp_available = True
        logger.info("MongoDB MCP server connected")
        return session
    except Exception as exc:
        logger.warning("Failed to start MongoDB MCP server (%s) — falling back to direct Motor driver", exc)
        _mcp_available = False
        return None


async def call_mcp_tool(tool_name: str, arguments: Dict[str, Any]) -> Any:
    """
    Call a tool on the MongoDB MCP server and return the parsed result.

    Returns None if MCP is not available (caller should fall back to Motor).
    """
    session = await _ensure_mcp_session()
    if session is None:
        return None

    try:
        result = await session.call_tool(tool_name, arguments=arguments)
        # MCP result is a list of content blocks; extract text
        if result and result.content:
            text = "\n".join(
                block.text for block in result.content if hasattr(block, "text")
            )
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return text
        return {}
    except Exception as exc:
        logger.error("MCP tool call '%s' failed: %s", tool_name, exc)
        return None


async def mcp_find(
    collection: str,
    filter_doc: Dict[str, Any],
    projection: Optional[Dict[str, Any]] = None,
    sort: Optional[Dict[str, Any]] = None,
    limit: int = 0,
    database: Optional[str] = None,
) -> Optional[List[dict]]:
    """
    Execute a MongoDB find via the MCP server.

    Returns None when MCP is unavailable so the caller can fall back to Motor.
    """
    db_name = database or os.environ.get("MONGODB_DB", "matchday")
    args: Dict[str, Any] = {
        "collection": collection,
        "database": db_name,
        "filter": filter_doc,
    }
    if projection:
        args["projection"] = projection
    if sort:
        args["sort"] = sort
    if limit:
        args["limit"] = limit

    return await call_mcp_tool("find", args)


async def mcp_find_one(
    collection: str,
    filter_doc: Dict[str, Any],
    projection: Optional[Dict[str, Any]] = None,
    database: Optional[str] = None,
) -> Optional[dict]:
    """
    Execute a MongoDB findOne via the MCP server.

    Returns None when MCP is unavailable.
    """
    result = await mcp_find(
        collection=collection,
        filter_doc=filter_doc,
        projection=projection,
        limit=1,
        database=database,
    )
    if result is None:
        return None  # MCP unavailable
    if isinstance(result, list):
        return result[0] if result else {}
    return result


async def mcp_insert_one(
    collection: str,
    document: Dict[str, Any],
    database: Optional[str] = None,
) -> Optional[dict]:
    """
    Insert a document via the MCP server.  Returns the inserted document with
    inserted_id on success, or None if MCP is unavailable.
    """
    db_name = database or os.environ.get("MONGODB_DB", "matchday")
    args = {
        "collection": collection,
        "database": db_name,
        "document": document,
    }
    return await call_mcp_tool("insertOne", args)


async def mcp_update_one(
    collection: str,
    filter_doc: Dict[str, Any],
    update: Dict[str, Any],
    upsert: bool = False,
    database: Optional[str] = None,
) -> Optional[dict]:
    """
    Update a document via the MCP server. Returns None if MCP is unavailable.
    """
    db_name = database or os.environ.get("MONGODB_DB", "matchday")
    args = {
        "collection": collection,
        "database": db_name,
        "filter": filter_doc,
        "update": update,
        "upsert": upsert,
    }
    return await call_mcp_tool("updateOne", args)
