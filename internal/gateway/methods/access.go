package methods

import (
	"slices"

	"github.com/nextlevelbuilder/vbpclaw/internal/permissions"
)

// canSeeAll checks if user has full data visibility (admin role OR owner user).
func canSeeAll(role permissions.Role, ownerIDs []string, userID string) bool {
	if permissions.HasMinRole(role, permissions.RoleAdmin) {
		return true
	}
	if userID != "" && slices.Contains(ownerIDs, userID) {
		return true
	}
	return false
}
