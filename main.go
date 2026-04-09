package main

import (
	_ "time/tzdata" // embed IANA timezone database for containers without tzdata

	"github.com/nextlevelbuilder/vbpclaw/cmd"
)

func main() {
	cmd.Execute()
}
