package main
import (
	"fmt"
	"strings"
)
func getShortTemplateName(fullName string) string {
	if strings.Contains(fullName, "___") {
		parts := strings.Split(fullName, "___")
		return parts[len(parts)-1]
	}
	name := strings.ReplaceAll(fullName, "template-namespaced-resources___", "")
	name = strings.ReplaceAll(name, "template-cluster-resources___", "")
	return name
}
func main() {
	fmt.Println(getShortTemplateName("template-namespaced-resources___developer"))
}
