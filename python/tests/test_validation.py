import pytest

from dsc.spatial.operations import (
    cross_section,
    find_path,
    raycast,
    restrict_to_navmesh,
)


def test_find_path_validation():
    with pytest.raises(ValueError, match="Missing domain id"):
        find_path(domain_id="", way_points=[{"x": 0, "y": 0, "z": 0}, {"x": 1, "y": 0, "z": 0}])
    with pytest.raises(ValueError, match="Missing waypoints"):
        find_path(domain_id="abc", way_points=None)
    with pytest.raises(ValueError, match="Not enough waypoints"):
        find_path(domain_id="abc", way_points=[{"x": 0, "y": 0, "z": 0}])


def test_restrict_validation():
    with pytest.raises(ValueError, match="Missing target"):
        restrict_to_navmesh(domain_id="abc", target=None)


def test_raycast_validation():
    with pytest.raises(ValueError, match="Missing refinement id"):
        raycast(domain_id="abc", ray=None)


def test_cross_section_validation():
    with pytest.raises(ValueError, match="Missing height"):
        cross_section(domain_id="abc", height=None, file_type="png")
    with pytest.raises(ValueError, match="Missing file type"):
        cross_section(domain_id="abc", height=1.0, file_type=None)
    with pytest.raises(ValueError, match="Invalid file type"):
        cross_section(domain_id="abc", height=1.0, file_type="gif")
