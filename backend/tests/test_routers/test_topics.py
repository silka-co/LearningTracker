"""Tests for the topics API router."""

import pytest


class TestTopicsAPI:
    def test_create_topic(self, client):
        """Test creating a new topic."""
        response = client.post("/api/topics", json={
            "name": "Politics",
            "description": "Political podcasts",
            "color": "#ef4444",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Politics"
        assert data["description"] == "Political podcasts"
        assert data["color"] == "#ef4444"
        assert data["podcast_count"] == 0
        assert "id" in data

    def test_create_duplicate_topic(self, client):
        """Test that creating a duplicate topic returns 409."""
        client.post("/api/topics", json={"name": "Politics"})
        response = client.post("/api/topics", json={"name": "Politics"})
        assert response.status_code == 409

    def test_list_topics(self, client):
        """Test listing all topics."""
        client.post("/api/topics", json={"name": "Politics"})
        client.post("/api/topics", json={"name": "Design"})

        response = client.get("/api/topics")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        names = {t["name"] for t in data}
        assert names == {"Politics", "Design"}

    def test_get_topic(self, client):
        """Test getting a single topic."""
        create_response = client.post("/api/topics", json={"name": "Vibe Coding"})
        topic_id = create_response.json()["id"]

        response = client.get(f"/api/topics/{topic_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Vibe Coding"

    def test_get_nonexistent_topic(self, client):
        """Test getting a topic that doesn't exist."""
        response = client.get("/api/topics/999")
        assert response.status_code == 404

    def test_update_topic(self, client):
        """Test updating a topic."""
        create_response = client.post("/api/topics", json={"name": "Old Name"})
        topic_id = create_response.json()["id"]

        response = client.put(f"/api/topics/{topic_id}", json={
            "name": "New Name",
            "color": "#22c55e",
        })
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"
        assert response.json()["color"] == "#22c55e"

    def test_delete_topic(self, client):
        """Test deleting an empty topic."""
        create_response = client.post("/api/topics", json={"name": "Temporary"})
        topic_id = create_response.json()["id"]

        response = client.delete(f"/api/topics/{topic_id}")
        assert response.status_code == 204

        # Verify it's gone
        response = client.get(f"/api/topics/{topic_id}")
        assert response.status_code == 404

    def test_delete_nonexistent_topic(self, client):
        """Test deleting a topic that doesn't exist."""
        response = client.delete("/api/topics/999")
        assert response.status_code == 404
