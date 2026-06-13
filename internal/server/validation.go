package server

import (
	"regexp"

	"github.com/go-playground/validator"
)

const validUsernameRegex = "^[a-z]([-a-z0-9]*[a-z0-9])?([@\\.-][a-z0-9]([-a-z0-9]*[a-z0-9])?)*$"
const validK8sNameRegex = "^[a-z]([-a-z0-9]*[a-z0-9])?$"

var (
	validUsernameRE = regexp.MustCompile(validUsernameRegex)
	validK8sNameRE  = regexp.MustCompile(validK8sNameRegex)
)

var invalidUsernameError = `username must be lowercase alphanumeric, and can contain "-", ".", or "@" for emails, and must start with a letter and end with an alphanumeric character. regex used for validation is ` + validUsernameRegex
var invalidK8sNameError = `name must be lowercase alphanumeric and can contain "-", and must start with a letter and end with an alphanumeric character. regex used for validation is ` + validK8sNameRegex

func isValidUsername(username string) (valid bool) {
	if len(username) > 63 || len(username) == 0 {
		return false
	}
	return validUsernameRE.MatchString(username)
}

func isValidK8sName(name string) (valid bool) {
	if len(name) > 63 || len(name) == 0 {
		return false
	}
	return validK8sNameRE.MatchString(name)
}

type CustomValidator struct {
	validator *validator.Validate
}

func (cv *CustomValidator) Validate(i interface{}) error {
	return cv.validator.Struct(i)

}
