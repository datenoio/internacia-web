from release import _include_roles, _institutional_design


def test_include_roles_lists_route_kinds(tmp_path):
    path = tmp_path / "include_roles.yaml"
    path.write_text(
        """
kinds:
  pipeline: {blocktypes: [gaspipeline, oilpipeline], roles: [origin, transit, destination]}
  corridor: {blocktypes: [corridor], roles: [terminal, transit]}
roles:
  origin: {name: Origin, description: "Starts\n  here."}
  transit: {name: Transit, description: Crosses.}
  terminal: {name: Terminal}
""",
        encoding="utf-8",
    )
    roles = _include_roles(path)
    assert roles["origin"] == {"name": "Origin", "description": "Starts here.", "blocktypes": ["gaspipeline", "oilpipeline"]}
    assert roles["transit"]["blocktypes"] == ["corridor", "gaspipeline", "oilpipeline"]
    assert roles["terminal"]["description"] == ""
    assert _include_roles(tmp_path / "missing.yaml") == {}


def test_institutional_design_keeps_catalog_order(tmp_path):
    path = tmp_path / "institutional_design.yaml"
    path.write_text(
        """
fields:
  mandate:
    name: Mandate
    kind: enum
    description: Primary domain.
    values:
      general: {name: General, description: Many.}
      security: {name: Security}
  mutual_defence: {name: Mutual defence, kind: boolean}
""",
        encoding="utf-8",
    )
    design = _institutional_design(path)
    assert list(design) == ["mandate", "mutual_defence"]
    assert list(design["mandate"]["values"]) == ["general", "security"]
    assert design["mandate"]["values"]["security"] == {"name": "Security", "description": ""}
    assert design["mutual_defence"]["values"] == {}
